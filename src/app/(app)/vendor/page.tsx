import { getBusinessContext } from "@/lib/business";
import type { ConsignmentSettlement, MenuItem, Vendor } from "@/lib/types";
import { withLiveStock } from "@/lib/stock";
import { VendorClient } from "./VendorClient";

export const dynamic = "force-dynamic";

const MY_OFFSET_MS = 8 * 60 * 60 * 1000;

function todayInMalaysia(): string {
  return new Date(Date.now() + MY_OFFSET_MS).toISOString().slice(0, 10);
}

export default async function VendorPage() {
  const { supabase, businessId } = await getBusinessContext();

  const today = todayInMalaysia();
  const start = new Date(today + "T00:00:00+08:00");
  const end = new Date(start.getTime() + 86400000);

  const [
    { data: vendors },
    { data: items },
    { data: shelfLife },
    { data: soldRows },
    { data: settlements },
    { data: receipts },
  ] = await Promise.all([
    supabase.from("vendors").select("*").eq("business_id", businessId).order("name"),
    supabase.from("menu_items").select("*").eq("business_id", businessId).order("name"),
    supabase.from("shelf_life").select("item, qty, vendor_id, expires_at").eq("business_id", businessId),
    supabase
      .from("transaction_items")
      .select("name, qty, transactions!inner(ts, business_id)")
      .eq("transactions.business_id", businessId)
      .gte("transactions.ts", start.toISOString())
      .lt("transactions.ts", end.toISOString()),
    supabase
      .from("consignment_settlements")
      .select("*, consignment_settlement_items(*)")
      .eq("business_id", businessId)
      .order("settled_at", { ascending: false })
      .limit(30),
    supabase
      .from("receipts")
      .select("id, receipt_date, note, vendor_id, image_path, created_at")
      .eq("business_id", businessId)
      .order("receipt_date", { ascending: false })
      .limit(100),
  ]);

  const liveItems = withLiveStock((items ?? []) as MenuItem[], shelfLife ?? []);

  const soldTodayMap: Record<string, number> = {};
  (soldRows ?? []).forEach((row: { name: string; qty: number }) => {
    const key = row.name.trim().toLowerCase();
    soldTodayMap[key] = (soldTodayMap[key] ?? 0) + (row.qty || 0);
  });

  // menu_items.vendor_id is the persistent "who supplies this" record — same
  // precedence rule used on Stock/Consignment, since shelf_life.vendor_id is
  // only a fallback guess from whichever batch rows currently exist.
  const itemVendorMap: Record<string, string> = {};
  (shelfLife ?? []).forEach((e: { item: string; vendor_id?: string | null }) => {
    if (e.vendor_id) itemVendorMap[e.item.trim().toLowerCase()] = e.vendor_id;
  });
  (items ?? []).forEach((m: MenuItem) => {
    if (m.vendor_id) itemVendorMap[m.name.trim().toLowerCase()] = m.vendor_id;
  });

  const paths = (receipts ?? []).map((r) => r.image_path);
  const { data: signed } = paths.length
    ? await supabase.storage.from("receipts").createSignedUrls(paths, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const receiptRows = (receipts ?? []).map((r) => ({
    id: r.id,
    date: r.receipt_date as string,
    note: r.note as string | null,
    vendorId: r.vendor_id as string | null,
    url: urlByPath.get(r.image_path) ?? null,
  }));

  return (
    <VendorClient
      vendors={(vendors ?? []) as Vendor[]}
      items={liveItems}
      itemVendorMap={itemVendorMap}
      soldTodayMap={soldTodayMap}
      settlements={(settlements ?? []) as ConsignmentSettlement[]}
      receipts={receiptRows}
    />
  );
}
