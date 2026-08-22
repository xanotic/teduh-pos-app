"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";

export async function createSettlement(input: {
  settledAt: string;
  periodLabel?: string;
  items: { name: string; deliveredQty: number; remainingQty: number; cost: number | null }[];
}) {
  if (!input.items.length) throw new Error("Add at least one item");

  const { supabase, businessId } = await getBusinessContext();

  const { data: settlement, error: settlementError } = await supabase
    .from("consignment_settlements")
    .insert({ business_id: businessId, settled_at: input.settledAt, period_label: input.periodLabel || null })
    .select("id")
    .single();
  if (settlementError || !settlement) throw new Error(settlementError?.message ?? "Could not save settlement");

  const { error: itemsError } = await supabase.from("consignment_settlement_items").insert(
    input.items.map((it) => ({
      settlement_id: settlement.id,
      name: it.name,
      delivered_qty: it.deliveredQty,
      remaining_qty: it.remainingQty,
      cost: it.cost,
    }))
  );
  if (itemsError) throw new Error(itemsError.message);

  revalidatePath("/consignment");
}

export async function markSettlementPaid(id: string, paid: boolean) {
  const { supabase } = await getBusinessContext();
  const { error } = await supabase
    .from("consignment_settlements")
    .update({ paid, paid_at: paid ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/consignment");
}

export async function deleteSettlement(id: string) {
  const { supabase } = await getBusinessContext();
  const { error } = await supabase.from("consignment_settlements").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/consignment");
}
