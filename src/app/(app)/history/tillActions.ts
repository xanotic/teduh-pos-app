"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";

export async function setOpeningBalance(date: string, amount: number) {
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase
    .from("daily_balances")
    .upsert({ business_id: businessId, date, opening_balance: amount }, { onConflict: "business_id,date" });
  if (error) throw new Error(error.message);
  revalidatePath("/history");
}

export async function setActualClosing(date: string, amount: number) {
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase
    .from("daily_balances")
    .upsert({ business_id: businessId, date, actual_closing: amount }, { onConflict: "business_id,date" });
  if (error) throw new Error(error.message);
  revalidatePath("/history");
}
