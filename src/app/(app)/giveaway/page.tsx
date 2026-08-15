import { getBusinessContext } from "@/lib/business";
import type { MenuItem, Transaction } from "@/lib/types";
import { CatalogCart } from "@/components/CatalogCart";
import { VoidableList } from "@/components/VoidableList";

export const dynamic = "force-dynamic";

export default async function GiveawayPage() {
  const { supabase, businessId } = await getBusinessContext();

  const [{ data: items }, { data: giveaways }] = await Promise.all([
    supabase.from("menu_items").select("*").eq("business_id", businessId).order("category").order("name"),
    supabase
      .from("transactions")
      .select("*, transaction_items(*)")
      .eq("business_id", businessId)
      .eq("payment_method", "Giveaway")
      .order("ts", { ascending: false })
      .limit(30),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold text-ink">Giveaway</h1>
      <p className="mb-4 text-sm text-ink-muted">
        Free items for a customer — you pay the till the full price yourself, so the drawer still
        balances at the end of the day.
      </p>
      <CatalogCart items={(items ?? []) as MenuItem[]} mode="giveaway" />

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-bold text-ink">Recent Giveaways</h2>
        <VoidableList
          transactions={(giveaways ?? []) as Transaction[]}
          emptyLabel="No giveaways logged yet."
          showNote
        />
      </div>
    </div>
  );
}
