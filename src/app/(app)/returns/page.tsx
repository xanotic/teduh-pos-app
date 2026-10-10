import { getBusinessContext } from "@/lib/business";
import type { MenuItem, ReturnEntry, Vendor } from "@/lib/types";
import { withLiveStock } from "@/lib/stock";
import { ReturnedClient } from "./ReturnedClient";

export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  const { supabase, businessId } = await getBusinessContext();

  const [{ data: items }, { data: shelfLife }, { data: vendors }, { data: returns }] = await Promise.all([
    supabase.from("menu_items").select("*").eq("business_id", businessId).order("name"),
    supabase.from("shelf_life").select("item, qty, expires_at").eq("business_id", businessId),
    supabase.from("vendors").select("*").eq("business_id", businessId).order("name"),
    supabase
      .from("returns")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const liveItems = withLiveStock((items ?? []) as MenuItem[], shelfLife ?? []);
  const trackedItems = liveItems.filter((it) => it.payment_type != null);

  return (
    <ReturnedClient
      items={trackedItems}
      vendors={(vendors ?? []) as Vendor[]}
      returns={(returns ?? []) as ReturnEntry[]}
    />
  );
}
