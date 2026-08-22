import { getBusinessContext } from "@/lib/business";
import type { ConsignmentSettlement, MenuItem, ShelfLifeEntry, Vendor } from "@/lib/types";
import { ConsignmentClient } from "./ConsignmentClient";
import { ItemsSoldPanel } from "./ItemsSoldPanel";

export const dynamic = "force-dynamic";

// Malaysia is UTC+8 with no DST — same explicit-offset approach used across
// History/Analytics, since Vercel functions run in UTC regardless of region.
const MY_OFFSET_MS = 8 * 60 * 60 * 1000;

function todayInMalaysia(): string {
  return new Date(Date.now() + MY_OFFSET_MS).toISOString().slice(0, 10);
}

function fmtShort(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

  const periodLabel = soldRange
    ? `${fmtShort(soldRange.from)} – ${fmtShort(soldRange.to)}`
    : soldDate
      ? fmtShort(soldDate)
      : `Today · ${fmtShort(todayInMalaysia())}`;

  let soldQuery = supabase
    .from("transaction_items")
    .select("name, qty, cost, transactions!inner(ts, business_id)")
    .eq("transactions.business_id", businessId)
    .order("ts", { referencedTable: "transactions", ascending: true });

  if (soldRange) {
    const start = new Date(soldRange.from + "T00:00:00+08:00");
    const end = new Date(new Date(soldRange.to + "T00:00:00+08:00").getTime() + 86400000);
    soldQuery = soldQuery.gte("transactions.ts", start.toISOString()).lt("transactions.ts", end.toISOString());
  } else {
    const start = new Date(effectiveSoldDate! + "T00:00:00+08:00");
    const end = new Date(start.getTime() + 86400000);
    soldQuery = soldQuery.gte("transactions.ts", start.toISOString()).lt("transactions.ts", end.toISOString());
  }

  const [{ data: settlements }, { data: shelfLifeData }, { data: soldRows }, { data: vendors }, { data: menuItems }] =
    await Promise.all([
      supabase
        .from("consignment_settlements")
        .select("*, consignment_settlement_items(*)")
        .eq("business_id", businessId)
        .order("settled_at", { ascending: false })
        .limit(20),
      supabase.from("shelf_life").select("*").eq("business_id", businessId),
      soldQuery,
      supabase.from("vendors").select("*").eq("business_id", businessId).order("name"),
      supabase.from("menu_items").select("*").eq("business_id", businessId),
    ]);

  // menu_items.vendor_id is the persistent "who supplies this" record, so it
  // takes precedence. shelf_life.vendor_id is only a fallback guess from
  // whichever batch rows currently exist (those get deleted once a batch
  // fully sells through, so they can't be relied on alone).
  const itemVendorMap: Record<string, string> = {};
  (shelfLifeData ?? []).forEach((e: ShelfLifeEntry) => {
    if (e.vendor_id) itemVendorMap[e.item.trim().toLowerCase()] = e.vendor_id;
  });
  (menuItems ?? []).forEach((m: MenuItem) => {
    if (m.vendor_id) itemVendorMap[m.name.trim().toLowerCase()] = m.vendor_id;
  });

  const soldBreakdownMap: Record<
    string,
    { name: string; qty: number; cost: number; hasMissingCost: boolean; sales: { ts: string; qty: number }[] }
  > = {};
  (soldRows ?? []).forEach(
    (row: { name: string; qty: number; cost: number | null; transactions: { ts: string } | { ts: string }[] }) => {
      const key = row.name.trim();
      soldBreakdownMap[key] ??= { name: key, qty: 0, cost: 0, hasMissingCost: false, sales: [] };
      soldBreakdownMap[key].qty += row.qty || 0;
      if (row.cost == null) {
        soldBreakdownMap[key].hasMissingCost = true;
      } else {
        soldBreakdownMap[key].cost += (row.qty || 0) * Number(row.cost);
      }
      const ts = Array.isArray(row.transactions) ? row.transactions[0]?.ts : row.transactions?.ts;
      if (ts) soldBreakdownMap[key].sales.push({ ts, qty: row.qty || 0 });
    }
  );

  // Classify each sold item as consignment/upfront/unknown. menu_items.payment_type
  // is the persistent record and takes precedence; the shelf_life/settlement-derived
  // sets are only a fallback guess for items added before that column existed —
  // shelf_life rows (and thus their payment_type) get deleted once a batch fully
  // sells through, which used to make a sold-out item's classification vanish.
  const menuPaymentTypeMap: Record<string, string> = {};
  (menuItems ?? []).forEach((m: MenuItem) => {
    if (m.payment_type) menuPaymentTypeMap[m.name.trim().toLowerCase()] = m.payment_type;
  });

  const consignmentNames = new Set<string>();
  const upfrontNames = new Set<string>();
  (shelfLifeData ?? []).forEach((e: ShelfLifeEntry) => {
    const key = e.item.trim().toLowerCase();
    if (e.payment_type === "consignment") consignmentNames.add(key);
    else if (e.payment_type === "upfront") upfrontNames.add(key);
  });
  (settlements ?? []).forEach((s) => {
    s.consignment_settlement_items?.forEach((it: { name: string }) => {
      consignmentNames.add(it.name.trim().toLowerCase());
    });
  });

  function classify(name: string): "consignment" | "upfront" | "unknown" {
    const key = name.trim().toLowerCase();
    if (menuPaymentTypeMap[key]) return menuPaymentTypeMap[key] as "consignment" | "upfront";
    if (consignmentNames.has(key)) return "consignment";
    if (upfrontNames.has(key)) return "upfront";
    return "unknown";
  }

  const soldBreakdown = Object.values(soldBreakdownMap)
    .map((r) => ({
      ...r,
      type: classify(r.name),
      vendorId: itemVendorMap[r.name.trim().toLowerCase()] ?? null,
    }))
    .sort((a, b) => b.qty - a.qty);

  return (
    <div className="mx-auto max-w-3xl">
      <ItemsSoldPanel breakdown={soldBreakdown} date={soldDate} range={soldRange} todayDate={todayInMalaysia()} />
      <ConsignmentClient
        settlements={(settlements ?? []) as ConsignmentSettlement[]}
        vendors={(vendors ?? []) as Vendor[]}
        soldItems={soldBreakdown}
        periodLabel={periodLabel}
      />
    </div>
  );
}
