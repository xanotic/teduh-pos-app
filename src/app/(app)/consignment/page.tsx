import { getBusinessContext } from "@/lib/business";
import type { ConsignmentSettlement, MenuItem, ShelfLifeEntry } from "@/lib/types";
import { ConsignmentClient } from "./ConsignmentClient";

export const dynamic = "force-dynamic";

export default async function ConsignmentPage() {
  const { supabase, businessId } = await getBusinessContext();

  const [{ data: settlements }, { data: menu }, { data: shelfLifeData }] = await Promise.all([
    supabase
      .from("consignment_settlements")
      .select("*, consignment_settlement_items(*)")
      .eq("business_id", businessId)
      .order("settled_at", { ascending: false })
      .limit(20),
    supabase.from("menu_items").select("*").eq("business_id", businessId).order("name"),
    supabase.from("shelf_life").select("*").eq("business_id", businessId),
  ]);

  const lastSettledAt = settlements && settlements.length > 0 ? settlements[0].settled_at : null;

  let query = supabase
    .from("transaction_items")
    .select("name, qty, transactions!inner(ts, business_id)")
    .eq("transactions.business_id", businessId);

  if (lastSettledAt) {
    query = query.gte("transactions.ts", lastSettledAt);
  }

  const { data: rawSales } = await query;

  const posSalesMap: Record<string, number> = {};
  (rawSales ?? []).forEach((row) => {
    const key = row.name.trim().toLowerCase();
    posSalesMap[key] = (posSalesMap[key] || 0) + (row.qty || 0);
  });

  return (
    <ConsignmentClient
      settlements={(settlements ?? []) as ConsignmentSettlement[]}
      menuItems={(menu ?? []) as MenuItem[]}
      shelfLifeEntries={(shelfLifeData ?? []) as ShelfLifeEntry[]}
      posSalesMap={posSalesMap}
      lastSettledAt={lastSettledAt}
    />
  );
}
