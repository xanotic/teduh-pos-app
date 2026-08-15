"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";

export async function addMenuItem(input: {
  name: string;
  category: string;
  price: number;
  cost: number | null;
}) {
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase.from("menu_items").insert({
    business_id: businessId,
    name: input.name,
    category: input.category.toUpperCase(),
    price: input.price,
    cost: input.cost,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/menu");
  revalidatePath("/sell");
  revalidatePath("/giveaway");
}

export async function updateMenuItem(
  id: string,
  patch: { name?: string; category?: string; price?: number; cost?: number | null }
) {
  const { supabase } = await getBusinessContext();
  const cleanPatch = { ...patch };
  if (cleanPatch.category) cleanPatch.category = cleanPatch.category.toUpperCase();
  const { error } = await supabase.from("menu_items").update(cleanPatch).eq("id", id);
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
}
