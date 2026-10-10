"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";

// Malaysia is UTC+8 with no DST — same explicit-offset approach used across
// business.ts/analytics/consignment/sales.ts, since Vercel runs in UTC.
const MY_OFFSET_MS = 8 * 60 * 60 * 1000;

function todayInMalaysia(): string {
  return new Date(Date.now() + MY_OFFSET_MS).toISOString().slice(0, 10);
}

function revalidateAll() {
  revalidatePath("/returns");
  revalidatePath("/shelf-life");
  revalidatePath("/menu");
  revalidatePath("/sell");
  revalidatePath("/giveaway");
  revalidatePath("/stock");
  revalidatePath("/vendor");
  revalidatePath("/analytics");
}

/**
 * Logs a vendor taking stock back early (before it expires) — pulls qty out
 * of the same FEFO (earliest-expiring-first) batches a sale would, so a
 * returned batch can't later be double-counted as sold or left to expire.
 * Upfront items give back the cash-paid ledger for the returned qty, since
 * that stock is no longer ours to have paid for.
 */
export async function createReturn(input: { item: string; qty: number; note?: string }) {
  const itemName = input.item.trim();
  const qty = Math.floor(input.qty);
  if (!itemName) throw new Error("Pick an item.");
  if (!(qty > 0)) throw new Error("Enter a quantity greater than 0.");

  const { supabase, businessId } = await getBusinessContext();

  const { data: menuItem } = await supabase
    .from("menu_items")
    .select("id, vendor_id, payment_type")
    .eq("business_id", businessId)
    .ilike("name", itemName)
    .maybeSingle();

  if (!menuItem || !menuItem.payment_type) {
    throw new Error(
      "This item isn't tracked in Shelf Life (set a Supply type for it on the Menu tab first) — nothing to return."
    );
  }

  const today = todayInMalaysia();
  const { data: batches } = await supabase
    .from("shelf_life")
    .select("id, qty, cost, expires_at")
    .eq("business_id", businessId)
    .ilike("item", itemName)
    .gte("expires_at", today)
    .order("expires_at", { ascending: true });

  const available = (batches ?? []).reduce((s, b) => s + (b.qty || 0), 0);
  if (qty > available) {
    throw new Error(`Only ${available} currently in stock for ${itemName} — can't return more than that.`);
  }

  let remaining = qty;
  let costConsumed = 0;
  let upfrontCostConsumed = 0;

  for (const batch of batches ?? []) {
    if (remaining <= 0) break;
    const batchQty = batch.qty || 0;
    const take = Math.min(batchQty, remaining);
    if (take <= 0) continue;

    const unitCost = batch.cost ?? 0;
    costConsumed += unitCost * take;
    if (menuItem.payment_type === "upfront") upfrontCostConsumed += unitCost * take;

    if (take >= batchQty) {
      await supabase.from("shelf_life").delete().eq("id", batch.id);
    } else {
      await supabase.from("shelf_life").update({ qty: batchQty - take }).eq("id", batch.id);
    }
    remaining -= take;
  }

  await supabase.rpc("adjust_menu_stock", { p_name: itemName, p_delta: -qty });

  if (upfrontCostConsumed > 0) {
    await supabase.rpc("adjust_upfront_paid", { p_delta: -upfrontCostConsumed });
  }

  const { error } = await supabase.from("returns").insert({
    business_id: businessId,
    item: itemName,
    vendor_id: menuItem.vendor_id ?? null,
    qty,
    payment_type: menuItem.payment_type,
    cost: qty > 0 ? costConsumed / qty : null,
    upfront_reversed: upfrontCostConsumed > 0 ? upfrontCostConsumed : null,
    note: input.note?.trim() || null,
  });
  if (error) throw new Error(error.message);

  revalidateAll();
}

/**
 * Undoes a logged return: puts the qty back on a current batch (best effort —
 * same fallback rules as restoring a voided sale; if literally no batch
 * exists any more for that item, the qty has nowhere to land and is skipped),
 * restores the menu stock number, and gives back any upfront ledger reversal.
 */
export async function deleteReturn(id: string) {
  const { supabase, businessId } = await getBusinessContext();

  const { data: ret, error: fetchError } = await supabase
    .from("returns")
    .select("item, qty, upfront_reversed")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();
  if (fetchError || !ret) throw new Error(fetchError?.message ?? "Return not found.");

  const { error } = await supabase.from("returns").delete().eq("id", id).eq("business_id", businessId);
  if (error) throw new Error(error.message);

  const today = todayInMalaysia();
  const { data: batches } = await supabase
    .from("shelf_life")
    .select("id, qty, initial_qty, expires_at")
    .eq("business_id", businessId)
    .ilike("item", ret.item)
    .order("expires_at", { ascending: false });

  if (batches && batches.length > 0) {
    const active = batches.filter((b) => b.expires_at >= today);
    const pool = active.length > 0 ? active : batches;
    const target = pool.find((b) => b.initial_qty != null && b.qty < b.initial_qty) || pool[0];
    const newQty = (target.qty || 0) + ret.qty;
    const patch: Record<string, unknown> = { qty: newQty };
    if (target.initial_qty != null && newQty > target.initial_qty) patch.initial_qty = newQty;
    await supabase.from("shelf_life").update(patch).eq("id", target.id);
  }

  await supabase.rpc("adjust_menu_stock", { p_name: ret.item, p_delta: ret.qty });

  if (ret.upfront_reversed) {
    await supabase.rpc("adjust_upfront_paid", { p_delta: ret.upfront_reversed });
  }

  revalidateAll();
}
