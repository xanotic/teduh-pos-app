import { getBusinessContext } from "@/lib/business";
import type { MenuItem, ShelfLifeEntry, Vendor } from "@/lib/types";
import { ShelfLifeClient } from "./ShelfLifeClient";

export const dynamic = "force-dynamic";

export default async function ShelfLifePage() {
  const { supabase, businessId } = await getBusinessContext();

  const [{ data: entries }, { data: menu }, { data: vendors }] = await Promise.all([
    supabase.from("shelf_life").select("*").eq("business_id", businessId),
    supabase.from("menu_items").select("*").eq("business_id", businessId).order("name"),
    supabase.from("vendors").select("*").eq("business_id", businessId).order("name"),
  ]);

  return (
    <ShelfLifeClient
      entries={(entries ?? []) as ShelfLifeEntry[]}
      menuItems={(menu ?? []) as MenuItem[]}
      vendors={(vendors ?? []) as Vendor[]}
    />
  );
}
