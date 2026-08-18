import { getBusinessContext } from "@/lib/business";
import type { HappyHourSettings, MenuItem } from "@/lib/types";
import { HappyHourClient } from "./HappyHourClient";

export const dynamic = "force-dynamic";

export default async function HappyHourPage() {
  const { supabase, businessId } = await getBusinessContext();

  const [{ data: settingsData }, { data: menuData }] = await Promise.all([
    supabase
      .from("happy_hour_settings")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle(),
    supabase
      .from("menu_items")
      .select("*")
      .eq("business_id", businessId)
      .order("name"),
  ]);

  const settings = settingsData as HappyHourSettings | null;
  const menuItems = (menuData ?? []) as MenuItem[];

  return <HappyHourClient initialSettings={settings} menuItems={menuItems} />;
}
