import { getBusinessContext } from "@/lib/business";
import { computeRestockRows } from "@/lib/restock";
import type { MenuItem, ShelfLifeEntry } from "@/lib/types";
import { Nav } from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, businessId, businessName } = await getBusinessContext();

  // A lighter version of the Restock page's query, just for the nav badge —
  // skips settlement history and 7-day sales velocity (those only affect
  // sorting/labels, not whether something needs restocking right now).
  const [{ data: menuItems }, { data: shelfLifeData }] = await Promise.all([
    supabase.from("menu_items").select("*").eq("business_id", businessId),
    supabase.from("shelf_life").select("*").eq("business_id", businessId),
  ]);
  const restockCount = computeRestockRows(
    (menuItems ?? []) as MenuItem[],
    (shelfLifeData ?? []) as ShelfLifeEntry[],
    [],
    []
  ).length;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <Nav businessName={businessName} restockCount={restockCount} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
