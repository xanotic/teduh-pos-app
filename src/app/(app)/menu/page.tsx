import { getBusinessContext } from "@/lib/business";
import type { MenuItem } from "@/lib/types";
import { MenuClient } from "./MenuClient";
import { withLiveStock } from "@/lib/stock";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const { supabase, businessId } = await getBusinessContext();

  const [{ data }, { data: shelfLife }] = await Promise.all([
    supabase.from("menu_items").select("*").eq("business_id", businessId).order("category").order("name"),
    supabase.from("shelf_life").select("item, qty, expires_at").eq("business_id", businessId),
  ]);

  const liveItems = withLiveStock((data ?? []) as MenuItem[], shelfLife ?? []);

  return <MenuClient items={liveItems} />;
}
