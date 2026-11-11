import { getBusinessContext } from "@/lib/business";
import type { Vendor } from "@/lib/types";
import { ReceiptsClient } from "./ReceiptsClient";

export const dynamic = "force-dynamic";

// Every receipt photo ever uploaded used to get a fresh signed url and get
// downloaded by the browser on every single page view (date/vendor search
// only filtered what was shown *after* everything was already fetched) — for
// a business with months of receipts, that meant re-downloading the entire
// photo history on every visit. Default to a recent window instead; the full
// history is still one click away via ?all=1.
const DEFAULT_WINDOW_DAYS = 60;

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const { supabase, businessId } = await getBusinessContext();
  const { all } = await searchParams;
  const showAll = all === "1";

  let receiptsQuery = supabase
    .from("receipts")
    .select("id, receipt_date, note, vendor_id, image_path, created_at")
    .eq("business_id", businessId)
    .order("receipt_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (!showAll) {
    const cutoff = new Date(Date.now() - DEFAULT_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
    receiptsQuery = receiptsQuery.gte("receipt_date", cutoff);
  }

  const [{ data: receipts }, { data: vendors }] = await Promise.all([
    receiptsQuery,
    supabase.from("vendors").select("*").eq("business_id", businessId).order("name"),
  ]);

  const paths = (receipts ?? []).map((r) => r.image_path);
  const { data: signed } = paths.length
    ? await supabase.storage.from("receipts").createSignedUrls(paths, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };

  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const rows = (receipts ?? []).map((r) => ({
    id: r.id,
    date: r.receipt_date as string,
    note: r.note as string | null,
    vendorId: r.vendor_id as string | null,
    imagePath: r.image_path as string,
    url: urlByPath.get(r.image_path) ?? null,
    uploadedAt: r.created_at as string,
  }));

  return (
    <ReceiptsClient
      receipts={rows}
      vendors={(vendors ?? []) as Vendor[]}
      showAll={showAll}
      windowDays={DEFAULT_WINDOW_DAYS}
    />
  );
}
