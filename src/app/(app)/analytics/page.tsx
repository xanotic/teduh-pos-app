import Link from "next/link";
import { getBusinessContext } from "@/lib/business";
import type { MenuItem, Transaction } from "@/lib/types";
import { computeStats, rangeStart, type RangeKey } from "@/lib/analytics";
import { fmt } from "@/lib/format";
import { BarChart } from "@/components/BarChart";
import { RankList } from "@/components/RankList";
import { TopItemsPanel } from "@/components/TopItemsPanel";
import { ChipList } from "@/components/ChipList";

export const dynamic = "force-dynamic";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "all", label: "All Time" },
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { supabase, businessId } = await getBusinessContext();
  const { range: rangeParam } = await searchParams;
  const range: RangeKey = (["today", "7d", "30d", "all"] as const).includes(rangeParam as RangeKey)
    ? (rangeParam as RangeKey)
    : "today";

  const start = rangeStart(range);
  let query = supabase
    .from("transactions")
    .select("*, transaction_items(*)")
    .eq("business_id", businessId);
  if (start) query = query.gte("ts", start.toISOString());

  const [{ data: txns }, { data: menu }] = await Promise.all([
    query,
    supabase.from("menu_items").select("*").eq("business_id", businessId),
  ]);

  const stats = computeStats((txns ?? []) as Transaction[]);
  const soldNames = new Set(stats.byItem.map((i) => i.name));
  const slowMovers = ((menu ?? []) as MenuItem[])
    .filter((it) => it.price > 0 && !soldNames.has(it.name))
    .map((it) => it.name);

  const kpis: { label: string; value: string }[] = [
    { label: "Revenue", value: fmt(stats.revenue) },
    { label: "Orders", value: String(stats.orders) },
    { label: "Items Sold", value: String(stats.itemsSold) },
    { label: "Avg Order", value: fmt(stats.avgOrder) },
  ];
  if (stats.hasCost) {
    kpis.push({ label: stats.costPartial ? "Est. Profit (partial)" : "Est. Profit", value: fmt(stats.profit) });
  }
  if (stats.giveawayCost > 0) {
    kpis.push({ label: "Giveaways (cost)", value: fmt(stats.giveawayCost) });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Analytics</h1>
          <p className="text-sm text-stone-500">Pick a range to filter everything below.</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/analytics?range=${r.key}`}
              className={`rounded-lg px-3.5 py-2 text-sm font-bold ${
                range === r.key ? "bg-rose-900 text-white" : "text-stone-500"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-stone-400">{k.label}</div>
            <div className="text-lg font-extrabold text-rose-900">{k.value}</div>
          </div>
        ))}
      </div>

      {range !== "today" && (
        <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-bold text-stone-800">Revenue by Day</h3>
          <BarChart data={stats.byDay} prefix="RM" />
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-bold text-stone-800">Busiest Hours</h3>
        <BarChart data={stats.byHour} prefix="RM" />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <TopItemsPanel byItem={stats.byItem} />

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-stone-800">By Category</h3>
          <RankList
            rows={stats.byCategory.map((c) => ({ label: c.name, value: fmt(c.revenue), sortVal: c.revenue }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-stone-800">Payment Split</h3>
          <RankList
            rows={stats.byPayment.map((p) => ({
              label: (p.name === "Cash" ? "💵 " : p.name === "QR Pay" ? "🔳 " : "🎁 ") + p.name,
              value: `${fmt(p.revenue)} · ${p.count}`,
              sortVal: p.revenue,
            }))}
          />
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="mb-1 text-sm font-bold text-stone-800">Not Selling</h3>
          <p className="mb-3 text-xs text-stone-400">
            Priced items with zero sales in this range — candidates to drop or promote.
          </p>
          <ChipList items={slowMovers} />
        </div>
      </div>
    </div>
  );
}
