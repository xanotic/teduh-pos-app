import { getBusinessContext } from "@/lib/business";
import type { UpfrontPayout, Vendor } from "@/lib/types";
import { UpfrontPayoutClient } from "./UpfrontPayoutClient";

export const dynamic = "force-dynamic";

export default async function UpfrontPayoutPage() {
  const { supabase, businessId } = await getBusinessContext();

  const [{ data: payouts }, { data: vendors }] = await Promise.all([
    supabase
      .from("upfront_payouts")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("vendors").select("*").eq("business_id", businessId).order("name"),
  ]);

  return (
    <UpfrontPayoutClient
      payouts={(payouts ?? []) as UpfrontPayout[]}
      vendors={(vendors ?? []) as Vendor[]}
    />
  );
}
