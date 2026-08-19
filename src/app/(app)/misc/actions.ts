"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";

export async function addMiscExpense(input: { description: string; amount: number; spentAt: string }) {
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase.from("misc_expenses").insert({
    business_id: businessId,
    description: input.description,
    amount: input.amount,
    spent_at: input.spentAt,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/misc");
}

export async function deleteMiscExpense(id: string) {
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase.from("misc_expenses").delete().eq("id", id).eq("business_id", businessId);
  if (error) throw new Error(error.message);
  revalidatePath("/misc");
}
