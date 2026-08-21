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

  // Break-even tracks real cash paid upfront — a running total, since this row
  // itself gets deleted once the batch sells through (see deductShelfLifeFifo).
  if (input.paymentType === "upfront" && input.cost) {
    await supabase.rpc("adjust_upfront_paid", { p_delta: entryQty * input.cost });
  }

  revalidatePath("/shelf-life");
  revalidatePath("/menu");
  revalidatePath("/sell");
  revalidatePath("/analytics");
}

export async function updateShelfLifeEntry(
  id: string,
  input: {
    item: string;
    expiresAt: string;
    notes: string;
    qty: number;
    cost: number | null;
    paymentType: PaymentType;
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

  const { error } = await supabase
    .from("shelf_life")
    .update({
      item: input.item,
      expires_at: input.expiresAt,
      notes: input.notes || null,
      qty: newQty,
      initial_qty: newQty,
      cost: input.cost,
      payment_type: input.paymentType,
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
  const oldUpfrontPaid = old.payment_type === "upfront" ? (old.initial_qty ?? old.qty) * (old.cost ?? 0) : 0;
  const newUpfrontPaid = input.paymentType === "upfront" ? newQty * (input.cost ?? 0) : 0;
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

  revalidatePath("/shelf-life");
  revalidatePath("/menu");
  revalidatePath("/sell");
  revalidatePath("/analytics");
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
