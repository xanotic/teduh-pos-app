import { getBusinessContext } from "@/lib/business";
import type { HappyHourSettings, MenuItem } from "@/lib/types";
import { fmt } from "@/lib/format";
import { CatalogCart } from "@/components/CatalogCart";

export const dynamic = "force-dynamic";

export default async function SellPage() {
  const { supabase, businessId } = await getBusinessContext();

  const [{ data: items }, { data: todayTxns }, { data: happyHourData }] = await Promise.all([
    supabase.from("menu_items").select("*").eq("business_id", businessId).order("category").order("name"),
    supabase
      .from("transactions")
      .select("total, ts")
      .eq("business_id", businessId)
      .gte("ts", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    supabase
      .from("happy_hour_settings")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);

  const todayTotal = (todayTxns ?? []).reduce((s, t) => s + Number(t.total), 0);
  const happyHour = happyHourData as HappyHourSettings | null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">Sell</h1>
        <div className="text-right">
          <div className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Today</div>
          <div className="text-lg font-extrabold text-success">{fmt(todayTotal)}</div>
        </div>
      </div>
      <CatalogCart items={(items ?? []) as MenuItem[]} mode="sell" happyHour={happyHour} />
    </div>
  );
}
