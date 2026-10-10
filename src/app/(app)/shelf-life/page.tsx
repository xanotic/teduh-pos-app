import { getBusinessContext } from "@/lib/business";
import type { MenuItem, ReturnEntry, ShelfLifeEntry, Vendor } from "@/lib/types";
import { ShelfLifeClient } from "./ShelfLifeClient";

export const dynamic = "force-dynamic";

export default async function ShelfLifePage() {
  const { supabase, businessId } = await getBusinessContext();

  const [{ data: entries }, { data: menu }, { data: vendors }, { data: returns }] = await Promise.all([
    supabase.from("shelf_life").select("*").eq("business_id", businessId),
    supabase.from("menu_items").select("*").eq("business_id", businessId).order("name"),
    supabase.from("vendors").select("*").eq("business_id", businessId).order("name"),
    supabase
      .from("returns")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <ShelfLifeClient
      entries={(entries ?? []) as ShelfLifeEntry[]}
      menuItems={(menu ?? []) as MenuItem[]}
      vendors={(vendors ?? []) as Vendor[]}
      returns={(returns ?? []) as ReturnEntry[]}
    />
  );
}
