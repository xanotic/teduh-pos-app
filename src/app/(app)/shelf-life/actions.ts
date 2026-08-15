"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";

export async function addShelfLifeEntry(input: { item: string; expiresAt: string; notes: string }) {
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase.from("shelf_life").insert({
    business_id: businessId,
    item: input.item,
    expires_at: input.expiresAt,
    notes: input.notes || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/shelf-life");
}

export async function deleteShelfLifeEntry(id: string) {
  const { supabase } = await getBusinessContext();
  const { error } = await supabase.from("shelf_life").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/shelf-life");
}
