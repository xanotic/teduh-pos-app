import { getBusinessContext } from "@/lib/business";
import type { ConsignmentSettlement, MenuItem } from "@/lib/types";
import { ConsignmentClient } from "./ConsignmentClient";

export const dynamic = "force-dynamic";

export default async function ConsignmentPage() {
  const { supabase, businessId } = await getBusinessContext();

  const [{ data: settlements }, { data: menu }] = await Promise.all([
    supabase
      .from("consignment_settlements")
      .select("*, consignment_settlement_items(*)")
      .eq("business_id", businessId)
      .order("settled_at", { ascending: false })
      .limit(20),
    supabase.from("menu_items").select("*").eq("business_id", businessId).order("name"),
  ]);

  return (
    <ConsignmentClient
      settlements={(settlements ?? []) as ConsignmentSettlement[]}
      menuItems={(menu ?? []) as MenuItem[]}
    />
  );
}
