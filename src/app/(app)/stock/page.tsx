import { getBusinessContext } from "@/lib/business";
import type { MenuItem, Vendor } from "@/lib/types";
import { withLiveStock } from "@/lib/stock";
import { StockClient } from "./StockClient";

export const dynamic = "force-dynamic";

// Malaysia is UTC+8 with no DST — same explicit-offset approach used across
// History/Analytics/Consignment, since Vercel functions run in UTC regardless of region.
const MY_OFFSET_MS = 8 * 60 * 60 * 1000;

function todayInMalaysia(): string {
  return new Date(Date.now() + MY_OFFSET_MS).toISOString().slice(0, 10);
}

export default async function StockPage() {
  const { supabase, businessId } = await getBusinessContext();

  const today = todayInMalaysia();
  const start = new Date(today + "T00:00:00+08:00");
  const end = new Date(start.getTime() + 86400000);

  const [{ data: items }, { data: shelfLife }, { data: vendors }, { data: soldRows }] = await Promise.all([
    supabase.from("menu_items").select("*").eq("business_id", businessId).order("category").order("name"),
    supabase.from("shelf_life").select("item, qty, vendor_id").eq("business_id", businessId),
    supabase.from("vendors").select("*").eq("business_id", businessId).order("name"),
    supabase
      .from("transaction_items")
      .select("name, qty, transactions!inner(ts, business_id)")
      .eq("transactions.business_id", businessId)
      .gte("transactions.ts", start.toISOString())
      .lt("transactions.ts", end.toISOString()),
  ]);

  const soldTodayMap: Record<string, number> = {};
  (soldRows ?? []).forEach((row: { name: string; qty: number }) => {
    const key = row.name.trim().toLowerCase();
    soldTodayMap[key] = (soldTodayMap[key] ?? 0) + (row.qty || 0);
  });

  // menu_items.vendor_id is the persistent "who supplies this" record —
  // shelf_life.vendor_id is only a fallback guess from whichever batch rows
  // currently exist (those get deleted once a batch fully sells through).
  const itemVendorMap: Record<string, string> = {};
  (shelfLife ?? []).forEach((e: { item: string; vendor_id?: string | null }) => {
    if (e.vendor_id) itemVendorMap[e.item.trim().toLowerCase()] = e.vendor_id;
  });
  (items ?? []).forEach((m: MenuItem) => {
    if (m.vendor_id) itemVendorMap[m.name.trim().toLowerCase()] = m.vendor_id;
  });

  const liveItems = withLiveStock((items ?? []) as MenuItem[], shelfLife ?? []);

  const rows = liveItems.map((it) => {
    const key = it.name.trim().toLowerCase();
    return {
      id: it.id,
      name: it.name,
      category: it.category,
      stock: it.stock,
      soldToday: soldTodayMap[key] ?? 0,
      vendorId: itemVendorMap[key] ?? null,
    };
  });

  return <StockClient rows={rows} vendors={(vendors ?? []) as Vendor[]} today={today} />;
}
