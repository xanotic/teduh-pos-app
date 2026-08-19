import { getBusinessContext } from "@/lib/business";
import type { ConsignmentSettlement, MenuItem, ShelfLifeEntry } from "@/lib/types";
import { ConsignmentClient } from "./ConsignmentClient";
import { ItemsSoldPanel } from "./ItemsSoldPanel";

export const dynamic = "force-dynamic";

// Malaysia is UTC+8 with no DST — same explicit-offset approach used across
// History/Analytics, since Vercel functions run in UTC regardless of region.
const MY_OFFSET_MS = 8 * 60 * 60 * 1000;

function todayInMalaysia(): string {
  return new Date(Date.now() + MY_OFFSET_MS).toISOString().slice(0, 10);
}

export default async function ConsignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; from?: string; to?: string }>;
}) {
  const { supabase, businessId } = await getBusinessContext();
  const { date: dateParam, from: fromParam, to: toParam } = await searchParams;

  const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const soldRange = isDate(fromParam) && isDate(toParam) ? { from: fromParam!, to: toParam! } : null;
  const soldDate = !soldRange && isDate(dateParam) ? dateParam! : null;
  const effectiveSoldDate = soldDate ?? (soldRange ? null : todayInMalaysia());

  let soldQuery = supabase
    .from("transaction_items")
    .select("name, qty, price, transactions!inner(ts, business_id)")
    .eq("transactions.business_id", businessId);

  if (soldRange) {
    const start = new Date(soldRange.from + "T00:00:00+08:00");
    const end = new Date(new Date(soldRange.to + "T00:00:00+08:00").getTime() + 86400000);
    soldQuery = soldQuery.gte("transactions.ts", start.toISOString()).lt("transactions.ts", end.toISOString());
  } else {
    const start = new Date(effectiveSoldDate! + "T00:00:00+08:00");
    const end = new Date(start.getTime() + 86400000);
    soldQuery = soldQuery.gte("transactions.ts", start.toISOString()).lt("transactions.ts", end.toISOString());
  }

  const [{ data: settlements }, { data: menu }, { data: shelfLifeData }, { data: soldRows }] = await Promise.all([
    supabase
      .from("consignment_settlements")
      .select("*, consignment_settlement_items(*)")
      .eq("business_id", businessId)
      .order("settled_at", { ascending: false })
      .limit(20),
    supabase.from("menu_items").select("*").eq("business_id", businessId).order("name"),
    supabase.from("shelf_life").select("*").eq("business_id", businessId),
    soldQuery,
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

  const soldBreakdownMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  (soldRows ?? []).forEach((row: { name: string; qty: number; price: number }) => {
    const key = row.name.trim();
    soldBreakdownMap[key] ??= { name: key, qty: 0, revenue: 0 };
    soldBreakdownMap[key].qty += row.qty || 0;
    soldBreakdownMap[key].revenue += (row.qty || 0) * Number(row.price || 0);
  });
  const soldBreakdown = Object.values(soldBreakdownMap).sort((a, b) => b.qty - a.qty);

  return (
    <div className="mx-auto max-w-3xl">
      <ItemsSoldPanel breakdown={soldBreakdown} date={soldDate} range={soldRange} />
      <ConsignmentClient
        settlements={(settlements ?? []) as ConsignmentSettlement[]}
        menuItems={(menu ?? []) as MenuItem[]}
        shelfLifeEntries={(shelfLifeData ?? []) as ShelfLifeEntry[]}
        posSalesMap={posSalesMap}
        lastSettledAt={lastSettledAt}
      />
    </div>
  );
}
