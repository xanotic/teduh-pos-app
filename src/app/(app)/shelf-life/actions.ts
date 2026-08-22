"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";
import type { PaymentType } from "@/lib/types";

export async function addShelfLifeEntry(input: {
  item: string;
  expiresAt: string;
  notes: string;
  paymentType: PaymentType;
  qty: number;
  cost: number | null;
  vendorId?: string | null;
}) {
  const { supabase, businessId } = await getBusinessContext();
  const entryQty = input.qty || 1;

  const { error } = await supabase.from("shelf_life").insert({
    business_id: businessId,
    item: input.item,
    expires_at: input.expiresAt,
    notes: input.notes || null,
    payment_type: input.paymentType,
    qty: entryQty,
    initial_qty: entryQty,
    cost: input.cost,
    vendor_id: input.vendorId || null,
  });
  if (error) throw new Error(error.message);

  // Auto-increment stock on the Menu page for matching menu item if stock tracking is enabled (stock != null)
  const { data: menuItem } = await supabase
    .from("menu_items")
    .select("id, stock")
    .eq("business_id", businessId)
    .ilike("name", input.item.trim())
    .maybeSingle();

  if (menuItem && menuItem.stock != null) {
    await supabase
      .from("menu_items")
      .update({ stock: menuItem.stock + entryQty })
      .eq("id", menuItem.id);
  }

  // menu_items.vendor_id / payment_type are the persistent records — shelf_life's
  // own vendor_id/payment_type only tag whichever batch rows exist right now,
  // and those get deleted once a batch sells through.
  await supabase
    .from("menu_items")
    .update({
      payment_type: input.paymentType,
      ...(input.vendorId ? { vendor_id: input.vendorId } : {}),
    })
    .eq("business_id", businessId)
    .ilike("name", input.item.trim());

  // Break-even tracks real cash paid upfront — a running total, since this row
  // itself gets deleted once the batch sells through (see deductShelfLifeFifo).
  if (input.paymentType === "upfront" && input.cost) {
    await supabase.rpc("adjust_upfront_paid", { p_delta: entryQty * input.cost });
  }

  revalidatePath("/shelf-life");
  revalidatePath("/menu");
  revalidatePath("/sell");
  revalidatePath("/analytics");
  revalidatePath("/consignment");
}

export async function updateShelfLifeEntry(
  id: string,
  input: {
    item: string;
    expiresAt: string;
    notes: string;
    qty: number;
    initialQty?: number;
    cost: number | null;
    paymentType: PaymentType;
    vendorId?: string | null;
  }
) {
  const { supabase, businessId } = await getBusinessContext();
  const newQty = input.qty || 1;

  const { data: old, error: fetchError } = await supabase
    .from("shelf_life")
    .select("item, qty, initial_qty, cost, payment_type, stock_deducted")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();
  if (fetchError || !old) throw new Error(fetchError?.message ?? "Entry not found.");

  const todayMY = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const stillExpired = input.expiresAt < todayMY;
  // Un-expiring a batch the sweep already marked spoiled: put its stock back
  // and let it re-enter the normal expiry check next time.
  const unexpiring = old.stock_deducted && !stillExpired;

  const oldInitial = old.initial_qty ?? old.qty;
  // Editing "Qty" here is normally a remaining-stock correction (a sale,
  // a manual recount), not a fresh batch — so the "X / Y left" original
  // batch size should survive a decrease. Only grow it, either because the
  // user explicitly set a new original qty, or because the corrected qty
  // itself now exceeds what we thought the original was.
  const newInitialQty = input.initialQty != null ? Math.max(1, input.initialQty) : Math.max(oldInitial, newQty);

  const { error } = await supabase
    .from("shelf_life")
    .update({
      item: input.item,
      expires_at: input.expiresAt,
      notes: input.notes || null,
      qty: newQty,
      initial_qty: newInitialQty,
      cost: input.cost,
      payment_type: input.paymentType,
      vendor_id: input.vendorId || null,
      ...(unexpiring ? { stock_deducted: false } : {}),
    })
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  if (unexpiring && old.qty > 0) {
    await supabase.rpc("adjust_menu_stock", { p_name: old.item.trim(), p_delta: old.qty });
  }

  // Break-even's cash-paid ledger only cares about the upfront-priced portion —
  // re-derive both sides so switching payment type or correcting qty/cost stays accurate.
  const oldUpfrontPaid = old.payment_type === "upfront" ? oldInitial * (old.cost ?? 0) : 0;
  const newUpfrontPaid = input.paymentType === "upfront" ? newInitialQty * (input.cost ?? 0) : 0;
  const upfrontPaidDelta = newUpfrontPaid - oldUpfrontPaid;
  if (upfrontPaidDelta !== 0) {
    await supabase.rpc("adjust_upfront_paid", { p_delta: upfrontPaidDelta });
  }

  const oldName = old.item.trim();
  const newName = input.item.trim();

  async function adjustStock(name: string, delta: number) {
    if (!delta) return;
    const { data: menuItem } = await supabase
      .from("menu_items")
      .select("id, stock")
      .eq("business_id", businessId)
      .ilike("name", name)
      .maybeSingle();
    if (menuItem && menuItem.stock != null) {
      await supabase
        .from("menu_items")
        .update({ stock: Math.max(0, menuItem.stock + delta) })
        .eq("id", menuItem.id);
    }
  }

  if (oldName.toLowerCase() === newName.toLowerCase()) {
    await adjustStock(newName, newQty - old.qty);
  } else {
    await adjustStock(oldName, -old.qty);
    await adjustStock(newName, newQty);
  }

  // menu_items.vendor_id / payment_type are the persistent records —
  // shelf_life's own copies only tag whichever batch rows exist right now.
  await supabase
    .from("menu_items")
    .update({
      payment_type: input.paymentType,
      ...(input.vendorId ? { vendor_id: input.vendorId } : {}),
    })
    .eq("business_id", businessId)
    .ilike("name", newName);

  revalidatePath("/consignment");
  revalidatePath("/shelf-life");
  revalidatePath("/menu");
  revalidatePath("/sell");
  revalidatePath("/analytics");
}

export async function addVendor(name: string) {
  const { supabase, businessId } = await getBusinessContext();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Vendor name is required.");

  const { data, error } = await supabase
    .from("vendors")
    .insert({ business_id: businessId, name: trimmed })
    .select("id, business_id, name, qr_url, created_at")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/shelf-life");
  revalidatePath("/consignment");
  return data;
}

export async function deleteVendor(id: string) {
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase.from("vendors").delete().eq("id", id).eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/shelf-life");
  revalidatePath("/consignment");
}

export async function uploadVendorQr(vendorId: string, formData: FormData) {
  const { supabase, businessId } = await getBusinessContext();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("No image selected.");
  if (!file.type.startsWith("image/")) throw new Error("QR file must be an image.");

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
  const path = `${businessId}/${vendorId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("vendor-qr")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from("vendor-qr").getPublicUrl(path);

  const { error } = await supabase
    .from("vendors")
    .update({ qr_url: publicUrlData.publicUrl })
    .eq("id", vendorId)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/shelf-life");
  revalidatePath("/consignment");
}

/** Assigns a vendor to every shelf-life batch matching this item name (case-insensitive) — lets the Consignment payout page attribute an item to a vendor even for batches added before that item had a vendor set. */
export async function setItemVendor(itemName: string, vendorId: string | null) {
  const { supabase, businessId } = await getBusinessContext();
  const name = itemName.trim();

  // menu_items.vendor_id is the persistent record — it survives a
  // consignment item selling completely out, unlike shelf_life rows which
  // get deleted once a batch sells through (see deductShelfLifeFifo).
  const { error: menuError } = await supabase
    .from("menu_items")
    .update({ vendor_id: vendorId })
    .eq("business_id", businessId)
    .ilike("name", name);
  if (menuError) throw new Error(menuError.message);

  const { error: shelfError } = await supabase
    .from("shelf_life")
    .update({ vendor_id: vendorId })
    .eq("business_id", businessId)
    .ilike("item", name);
  if (shelfError) throw new Error(shelfError.message);

  revalidatePath("/shelf-life");
  revalidatePath("/consignment");
  revalidatePath("/menu");
}

export async function deleteShelfLifeEntry(id: string) {
  const { supabase, businessId } = await getBusinessContext();

  // Fetch the entry details before deleting to adjust stock
  const { data: entry } = await supabase
    .from("shelf_life")
    .select("item, qty, initial_qty, cost, payment_type, stock_deducted")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("shelf_life").delete().eq("id", id);
  if (error) throw new Error(error.message);

  // Deleting a row is the user undoing an entry outright, so unlike a batch
  // simply selling through, the cash-paid ledger should give that back too.
  if (entry && entry.payment_type === "upfront" && entry.cost) {
    const paid = (entry.initial_qty ?? entry.qty) * entry.cost;
    if (paid) await supabase.rpc("adjust_upfront_paid", { p_delta: -paid });
  }

  // If this batch already expired, the sweep already removed its stock — don't double-subtract.
  if (entry && !entry.stock_deducted) {
    const { data: menuItem } = await supabase
      .from("menu_items")
      .select("id, stock")
      .eq("business_id", businessId)
      .ilike("name", entry.item.trim())
      .maybeSingle();

    if (menuItem && menuItem.stock != null) {
      const updatedStock = Math.max(0, menuItem.stock - (entry.qty || 1));
      await supabase
        .from("menu_items")
        .update({ stock: updatedStock })
        .eq("id", menuItem.id);
    }
  }

  revalidatePath("/shelf-life");
  revalidatePath("/menu");
  revalidatePath("/sell");
  revalidatePath("/analytics");
}
