import { getBusinessContext } from "@/lib/business";
import type { MiscExpense } from "@/lib/types";
import { MiscClient } from "./MiscClient";

export const dynamic = "force-dynamic";

export default async function MiscPage() {
  const { supabase, businessId } = await getBusinessContext();

  const { data } = await supabase
    .from("misc_expenses")
    .select("*")
    .eq("business_id", businessId)
    .order("spent_at", { ascending: false })
    .order("created_at", { ascending: false });

  return <MiscClient expenses={(data ?? []) as MiscExpense[]} />;
}
