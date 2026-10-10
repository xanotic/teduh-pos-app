"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";
import type { PaymentType } from "@/lib/types";

export async function addMenuItem(input: {
  name: string;
  price: number;
  cost: number | null;
  stock: number | null;
  paymentType?: PaymentType | null;
  vendorId?: string | null;
  vendorName?: string | null;
}) {
  const { supabase, businessId } = await getBusinessContext();
  // menu_items.category is a required DB column from the old category-based
  // layout — no longer shown or editable in the UI (vendor replaced it as
  // the organizing field), so it's just auto-filled here to satisfy the
  // not-null constraint without a schema migration.
  const { error } = await supabase.from("menu_items").insert({
    business_id: businessId,
    name: input.name,
    category: (input.vendorName?.trim() || "ITEM").toUpperCase(),
    price: input.price,
    cost: input.cost,
    stock: input.stock,
    payment_type: input.paymentType ?? null,
    vendor_id: input.vendorId ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/menu");
  revalidatePath("/sell");
  revalidatePath("/giveaway");
  revalidatePath("/shelf-life");
  revalidatePath("/consignment");
  revalidatePath("/vendor");
}

export async function updateMenuItem(
  id: string,
  patch: {
    name?: string;
    price?: number;
    cost?: number | null;
    stock?: number | null;
    payment_type?: PaymentType | null;
    vendor_id?: string | null;
  }
) {
  const { supabase, businessId } = await getBusinessContext();
  const cleanPatch = { ...patch };
  const { data, error } = await supabase
    .from("menu_items")
    .update(cleanPatch)
    .eq("id", id)
    .eq("business_id", businessId)
    .select("id, name, category, price, cost, stock, payment_type, vendor_id")
    .single();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("Update didn't apply — this item may not belong to your account. Refresh and try again.");
  }
  // Postgres numeric columns (price, cost) often come back as strings to
  // preserve precision, so compare numerically rather than by strict equality.
  const normalize = (v: unknown) => (typeof v === "string" && v !== "" && !isNaN(Number(v)) ? Number(v) : v);
  for (const key of Object.keys(cleanPatch) as (keyof typeof cleanPatch)[]) {
    if (normalize(data[key]) !== normalize(cleanPatch[key])) {
      throw new Error(
        `Save mismatch on "${key}": sent ${JSON.stringify(cleanPatch[key])}, database has ${JSON.stringify(data[key])}. Refresh and report this.`
      );
    }
  }
  revalidatePath("/menu");
  revalidatePath("/sell");
  revalidatePath("/giveaway");
  revalidatePath("/shelf-life");
  revalidatePath("/consignment");
  revalidatePath("/vendor");
}

// Only plain-stock items (payment_type null) — Shelf Life items' stock is
// computed live from their batches (see withLiveStock), so zeroing
// menu_items.stock for those would do nothing visible and just leave a
// stale number behind for whenever they stop being tracked.
export async function resetAllStock() {
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase
    .from("menu_items")
    .update({ stock: 0 })
    .eq("business_id", businessId)
    .is("payment_type", null)
    .not("stock", "is", null);
  if (error) throw new Error(error.message);
  revalidatePath("/menu");
  revalidatePath("/sell");
  revalidatePath("/giveaway");
}

export async function deleteMenuItem(id: string) {
  const { supabase } = await getBusinessContext();
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/menu");
  revalidatePath("/sell");
  revalidatePath("/giveaway");
  revalidatePath("/vendor");
}
