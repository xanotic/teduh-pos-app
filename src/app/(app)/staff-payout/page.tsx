import { getBusinessContext } from "@/lib/business";
import type { Staff, StaffPayout } from "@/lib/types";
import { StaffPayoutClient } from "./StaffPayoutClient";

export const dynamic = "force-dynamic";

export default async function StaffPayoutPage() {
  const { supabase, businessId } = await getBusinessContext();

  const [{ data: staff }, { data: payouts }] = await Promise.all([
    supabase.from("staff").select("*").eq("business_id", businessId).order("name"),
    supabase
      .from("staff_payouts")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <StaffPayoutClient
      staff={(staff ?? []) as Staff[]}
      payouts={(payouts ?? []) as StaffPayout[]}
    />
  );
}
