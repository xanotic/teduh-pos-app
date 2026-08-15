import { getBusinessContext } from "@/lib/business";
import type { Transaction } from "@/lib/types";
import { HistoryClient } from "./HistoryClient";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const { supabase, businessId } = await getBusinessContext();

  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const { data } = await supabase
    .from("transactions")
    .select("*, transaction_items(*)")
    .eq("business_id", businessId)
    .gte("ts", startOfDay)
    .order("ts", { ascending: false });

  return <HistoryClient transactions={(data ?? []) as Transaction[]} />;
}
