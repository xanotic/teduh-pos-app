import { getBusinessContext } from "@/lib/business";
import type { Vendor } from "@/lib/types";
import { ReceiptsClient } from "./ReceiptsClient";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  const { supabase, businessId } = await getBusinessContext();

  const [{ data: receipts }, { data: vendors }] = await Promise.all([
    supabase
      .from("receipts")
      .select("id, receipt_date, note, vendor_id, image_path, created_at")
      .eq("business_id", businessId)
      .order("receipt_date", { ascending: false })
      .order("created_at", { ascending: false }),
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
  }));

  return <ReceiptsClient receipts={rows} vendors={(vendors ?? []) as Vendor[]} />;
}
