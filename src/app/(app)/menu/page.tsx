import { getBusinessContext } from "@/lib/business";
import type { MenuItem } from "@/lib/types";
import { MenuClient } from "./MenuClient";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const { supabase, businessId } = await getBusinessContext();

  const { data } = await supabase
    .from("menu_items")
    .select("*")
    .eq("business_id", businessId)
    .order("category")
    .order("name");

  return <MenuClient items={(data ?? []) as MenuItem[]} />;
}
