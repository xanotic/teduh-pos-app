"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";
import type { CartLine, PaymentMethod } from "@/lib/types";

// Malaysia is UTC+8 with no DST — same explicit-offset approach used across
// business.ts/analytics/consignment, since Vercel functions run in UTC.
const MY_OFFSET_MS = 8 * 60 * 60 * 1000;

function todayInMalaysia(): string {
  return new Date(Date.now() + MY_OFFSET_MS).toISOString().slice(0, 10);
}

async function deductShelfLifeFifo(
  supabase: any,
  businessId: string,
  itemName: string,
  qtyToDeduct: number
) {
  if (qtyToDeduct <= 0) return;

  // Only ever deduct from batches that are still counted in the live stock
  // number (see withLiveStock) — an expired batch keeps its leftover qty
  // until the nightly sweep, but selling more should never reach into that
  // invisible qty, or the on-screen count won't move even though a real
  // (visible) batch should have been the one to shrink.
  const { data: batches } = await supabase
    .from("shelf_life")
    .select("id, qty, expires_at, payment_type")
    .eq("business_id", businessId)
    .ilike("item", itemName.trim())
    .gte("expires_at", todayInMalaysia())
    .order("expires_at", { ascending: true })
    .order("payment_type", { ascending: false });

  if (!batches || batches.length === 0) return;

  let remaining = qtyToDeduct;

  for (const batch of batches) {
    if (remaining <= 0) break;
    const batchQty = batch.qty || 1;

    if (batchQty <= remaining) {
      remaining -= batchQty;
      await supabase.from("shelf_life").delete().eq("id", batch.id);
    } else {
      const newQty = batchQty - remaining;
      remaining = 0;
      await supabase.from("shelf_life").update({ qty: newQty }).eq("id", batch.id);
    }
  }
}

async function restoreShelfLife(
  supabase: any,
  businessId: string,
  itemName: string,
  qtyToRestore: number
) {
  if (qtyToRestore <= 0) return;

  const { data: batches } = await supabase
    .from("shelf_life")
    .select("id, qty, initial_qty, expires_at")
    .eq("business_id", businessId)
    .ilike("item", itemName.trim())
    .order("expires_at", { ascending: false });

  if (batches && batches.length > 0) {
    const today = todayInMalaysia();
    const active = batches.filter((b: any) => b.expires_at >= today);
    // Restoring a voided sale should land back on a batch that's actually
    // still visible in the live stock count — only fall back to an expired
    // one if that's genuinely all that's left, so the qty isn't lost outright.
    const pool = active.length > 0 ? active : batches;
    // Prefer adding back to a batch that was partially depleted (qty < initial_qty)
    const targetBatch =
      pool.find((b: any) => b.initial_qty != null && b.qty < b.initial_qty) || pool[0];
    const currentQty = targetBatch.qty || 0;
    const newQty = currentQty + qtyToRestore;
    const patch: Record<string, any> = { qty: newQty };
    if (targetBatch.initial_qty != null && newQty > targetBatch.initial_qty) {
      patch.initial_qty = newQty;
    }
    await supabase.from("shelf_life").update(patch).eq("id", targetBatch.id);
  }
}

/**
 * Shared by both Sell (Cash/QR Pay) and Giveaway (Giveaway payment method).
 * A giveaway is priced at full sell price, same as a normal sale — the owner
 * is paying the till themselves, so revenue/history/analytics all treat it
 * like any other transaction, just tagged by payment method.
 */
export async function finalizeSale(paymentMethod: PaymentMethod, lines: CartLine[], note?: string) {
  if (!lines.length) throw new Error("Cart is empty");

  const { supabase, businessId } = await getBusinessContext();
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);

  const { data: txn, error: txnError } = await supabase
    .from("transactions")
    .insert({ business_id: businessId, payment_method: paymentMethod, note: note || null, total })
    .select("id")
    .single();
  if (txnError || !txn) throw new Error(txnError?.message ?? "Could not create transaction");

  const { error: itemsError } = await supabase.from("transaction_items").insert(
    lines.map((l) => ({
      transaction_id: txn.id,
      name: l.name,
      category: l.category,
      price: l.price,
      cost: l.cost,
      qty: l.qty,
    }))
  );
  if (itemsError) throw new Error(itemsError.message);

  await Promise.all([
    ...lines.map((l) => supabase.rpc("adjust_menu_stock", { p_name: l.name, p_delta: -l.qty })),
    ...lines.map((l) => deductShelfLifeFifo(supabase, businessId, l.name, l.qty)),
  ]);

  revalidatePath("/sell");
  revalidatePath("/giveaway");
  revalidatePath("/history");
  revalidatePath("/analytics");
  revalidatePath("/menu");
  revalidatePath("/shelf-life");
}

export async function voidTransaction(id: string) {
  const { supabase, businessId } = await getBusinessContext();

  const { data: txn } = await supabase
    .from("transactions")
    .select("transaction_items(name, qty)")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);

  if (txn && txn.transaction_items) {
    const items = txn.transaction_items as { name: string; qty: number }[];
    await Promise.all([
      ...items.map((l) =>
        supabase.rpc("adjust_menu_stock", { p_name: l.name, p_delta: l.qty })
      ),
      ...items.map((l) => restoreShelfLife(supabase, businessId, l.name, l.qty)),
    ]);
  }

  revalidatePath("/history");
  revalidatePath("/giveaway");
  revalidatePath("/analytics");
  revalidatePath("/menu");
  revalidatePath("/shelf-life");
}

export async function updateTransaction(
  id: string,
  paymentMethod: PaymentMethod,
  lines: { name: string; category: string; price: number; cost: number | null; qty: number }[]
) {
  if (!lines.length) throw new Error("A transaction needs at least one item — void it instead");

  const { supabase, businessId } = await getBusinessContext();
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);

  const { data: existing } = await supabase
    .from("transaction_items")
    .select("name, qty")
    .eq("transaction_id", id);

  const { error: updateError } = await supabase
    .from("transactions")
    .update({ payment_method: paymentMethod, total })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);

  const { error: deleteError } = await supabase.from("transaction_items").delete().eq("transaction_id", id);
  if (deleteError) throw new Error(deleteError.message);

  const { error: insertError } = await supabase.from("transaction_items").insert(
    lines.map((l) => ({ transaction_id: id, ...l }))
  );
  if (insertError) throw new Error(insertError.message);

  // Restore stock for the old line-up, then deduct for the new one — net effect
  // is only the difference actually gets applied.
  const menuStockPromises = [
    ...(existing ?? []).map((l) => supabase.rpc("adjust_menu_stock", { p_name: l.name, p_delta: l.qty })),
    ...lines.map((l) => supabase.rpc("adjust_menu_stock", { p_name: l.name, p_delta: -l.qty })),
  ];

  // Calculate net delta for shelf-life per item name
  const qtyDeltaMap = new Map<string, number>();
  for (const line of lines) {
    const key = line.name.trim();
    qtyDeltaMap.set(key, (qtyDeltaMap.get(key) || 0) + line.qty);
  }
  for (const ex of existing ?? []) {
    const key = ex.name.trim();
    qtyDeltaMap.set(key, (qtyDeltaMap.get(key) || 0) - ex.qty);
  }

  const shelfLifePromises: Promise<any>[] = [];
  for (const [itemName, delta] of qtyDeltaMap.entries()) {
    if (delta > 0) {
      shelfLifePromises.push(deductShelfLifeFifo(supabase, businessId, itemName, delta));
    } else if (delta < 0) {
      shelfLifePromises.push(restoreShelfLife(supabase, businessId, itemName, Math.abs(delta)));
    }
  }

  await Promise.all([...menuStockPromises, ...shelfLifePromises]);

  revalidatePath("/history");
  revalidatePath("/analytics");
  revalidatePath("/menu");
  revalidatePath("/shelf-life");
}
