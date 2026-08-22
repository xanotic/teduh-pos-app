import { getBusinessContext } from "@/lib/business";
import { computeRestockRows } from "@/lib/restock";
import type { MenuItem, ShelfLifeEntry, Vendor } from "@/lib/types";
import { RestockClient } from "./RestockClient";

export const dynamic = "force-dynamic";

export default async function RestockPage() {
  const { supabase, businessId } = await getBusinessContext();

  const sevenDaysAgoIso = new Date(Date.now() - 7 * 86400000).toISOString();

  const [{ data: menuItems }, { data: shelfLifeData }, { data: vendors }, { data: settlements }, { data: recentSales }] =
    await Promise.all([
      supabase.from("menu_items").select("*").eq("business_id", businessId).order("category").order("name"),
      supabase.from("shelf_life").select("*").eq("business_id", businessId),
      supabase.from("vendors").select("*").eq("business_id", businessId).order("name"),
      supabase
        .from("consignment_settlements")
        .select("consignment_settlement_items(name)")
        .eq("business_id", businessId),
      supabase
        .from("transaction_items")
        .select("name, qty, transactions!inner(ts, business_id)")
        .eq("transactions.business_id", businessId)
        .gte("transactions.ts", sevenDaysAgoIso),
    ]);

  const historicalShelfLifeNames = (settlements ?? []).flatMap((s) =>
    (s.consignment_settlement_items ?? []).map((it: { name: string }) => it.name)
  );

  const rows = computeRestockRows(
    (menuItems ?? []) as MenuItem[],
    (shelfLifeData ?? []) as ShelfLifeEntry[],
    historicalShelfLifeNames,
    (recentSales ?? []).map((r: { name: string; qty: number }) => ({ name: r.name, qty: r.qty }))
  );

  return <RestockClient rows={rows} vendors={(vendors ?? []) as Vendor[]} />;
}
