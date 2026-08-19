"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";

export async function addMenuItem(input: {
  name: string;
  category: string;
  price: number;
  cost: number | null;
  stock: number | null;
}) {
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase.from("menu_items").insert({
    business_id: businessId,
    name: input.name,
    category: input.category.toUpperCase(),
    price: input.price,
    cost: input.cost,
    stock: input.stock,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/menu");
  revalidatePath("/sell");
  revalidatePath("/giveaway");
}

export async function updateMenuItem(
  id: string,
  patch: { name?: string; category?: string; price?: number; cost?: number | null; stock?: number | null }
) {
  const { supabase, businessId } = await getBusinessContext();
  const cleanPatch = { ...patch };
  if (cleanPatch.category) cleanPatch.category = cleanPatch.category.toUpperCase();
  const { data, error } = await supabase
    .from("menu_items")
    .update(cleanPatch)
    .eq("id", id)
    .eq("business_id", businessId)
    .select("id, name, category, price, cost, stock")
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
}

export async function bulkUpdateStock(updates: { id: string; stock: number | null }[]) {
  if (!updates.length) return;
  const { supabase, businessId } = await getBusinessContext();
  const results = await Promise.all(
    updates.map((u) =>
      supabase
        .from("menu_items")
        .update({ stock: u.stock })
        .eq("id", u.id)
        .eq("business_id", businessId)
        .select("id")
        .single()
    )
  );
  const failed = results.filter((r) => r.error || !r.data);
  if (failed.length) {
    throw new Error(`${failed.length} of ${updates.length} item(s) failed to save. Refresh and try again.`);
  }
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
}
