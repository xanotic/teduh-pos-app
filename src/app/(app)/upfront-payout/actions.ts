"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";

export async function createUpfrontPayout(input: { vendorId: string | null; amount: number; note?: string }) {
  if (!(input.amount > 0)) throw new Error("Enter an amount greater than 0.");

  const { supabase, businessId } = await getBusinessContext();

  const { error } = await supabase.from("upfront_payouts").insert({
    business_id: businessId,
    vendor_id: input.vendorId,
    amount: input.amount,
    note: input.note?.trim() || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/upfront-payout");
}

export async function markUpfrontPayoutPaid(id: string, paid: boolean) {
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase
    .from("upfront_payouts")
    .update({ paid, paid_at: paid ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);
  revalidatePath("/upfront-payout");
}

export async function deleteUpfrontPayout(id: string) {
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase.from("upfront_payouts").delete().eq("id", id).eq("business_id", businessId);
  if (error) throw new Error(error.message);
  revalidatePath("/upfront-payout");
}
