import Link from "next/link";
import { getBusinessContext } from "@/lib/business";
import type { ConsignmentSettlement, MenuItem, ShelfLifeEntry, Transaction } from "@/lib/types";
import { computeFoodFinancials, computeStats, rangeStart, type RangeKey } from "@/lib/analytics";
import { fmt } from "@/lib/format";
import { BarChart } from "@/components/BarChart";
import { RankList } from "@/components/RankList";
import { TopItemsPanel } from "@/components/TopItemsPanel";
import { ChipList } from "@/components/ChipList";
import { DatePicker, DateRangePicker } from "./DatePicker";
import { ExportButton } from "./ExportButton";

export const dynamic = "force-dynamic";

// Malaysia is UTC+8 with no DST — computed explicitly since Vercel functions
// run in UTC regardless of the configured region (same approach as History).
const MY_OFFSET_MS = 8 * 60 * 60 * 1000;

// Break-even tracking (cumulative_upfront_paid ledger) only started being
// recorded from this date — revenue from before it existed would inflate
// "recovered" against upfront costs that were never logged, so the
// break-even window starts here instead of at the true beginning of history.
const BREAK_EVEN_START = "2026-08-19";

function todayInMalaysia(): string {
  return new Date(Date.now() + MY_OFFSET_MS).toISOString().slice(0, 10);
}

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "all", label: "All Time" },
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; date?: string; from?: string; to?: string }>;
}) {
  const { supabase, businessId } = await getBusinessContext();
  const { range: rangeParam, date: dateParam, from: fromParam, to: toParam } = await searchParams;

  const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const customRange = isDate(fromParam) && isDate(toParam) ? { from: fromParam!, to: toParam! } : null;
  const customDate = !customRange && isDate(dateParam) ? dateParam! : null;
  const range: RangeKey = (["today", "7d", "30d", "all"] as const).includes(rangeParam as RangeKey)
    ? (rangeParam as RangeKey)
    : "today";

  let query = supabase
    .from("transactions")
    .select("*, transaction_items(*)")
    .eq("business_id", businessId);

  if (customRange) {
    const rangeStartD = new Date(customRange.from + "T00:00:00+08:00");
    const rangeEndD = new Date(new Date(customRange.to + "T00:00:00+08:00").getTime() + 86400000);
    query = query.gte("ts", rangeStartD.toISOString()).lt("ts", rangeEndD.toISOString());
  } else if (customDate) {
    const dayStart = new Date(customDate + "T00:00:00+08:00");
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    query = query.gte("ts", dayStart.toISOString()).lt("ts", dayEnd.toISOString());
  } else {
    const start = rangeStart(range);
    if (start) query = query.gte("ts", start.toISOString());
  }

  const [{ data: txns }, { data: menu }, { data: shelfLifeData }, { data: settlementsData }, { data: business }, { data: allTxns }] =
    await Promise.all([
      query,
      supabase.from("menu_items").select("*").eq("business_id", businessId),
      supabase.from("shelf_life").select("*").eq("business_id", businessId),
      supabase
        .from("consignment_settlements")
        .select("*, consignment_settlement_items(*)")
        .eq("business_id", businessId),
      supabase.from("businesses").select("cumulative_upfront_paid").eq("id", businessId).single(),
      supabase
        .from("transactions")
        .select("total")
        .eq("business_id", businessId)
        .gte("ts", new Date(BREAK_EVEN_START + "T00:00:00+08:00").toISOString()),
    ]);

  const stats = computeStats((txns ?? []) as Transaction[]);
  const allTimeRevenue = (allTxns ?? []).reduce((sum, t) => sum + Number(t.total), 0);
  const foodFinancials = computeFoodFinancials(
    stats.cost,
    Number(business?.cumulative_upfront_paid ?? 0),
    allTimeRevenue,
    (shelfLifeData ?? []) as ShelfLifeEntry[],
    (settlementsData ?? []) as ConsignmentSettlement[]
  );

  const soldNames = new Set(stats.byItem.map((i) => i.name));
  const slowMovers = ((menu ?? []) as MenuItem[])
    .filter((it) => it.price > 0 && !soldNames.has(it.name))
    .map((it) => it.name);

  const kpis: { label: string; value: string; hint?: string }[] = [
    { label: "Revenue", value: fmt(stats.revenue) },
    { label: "Upfront Food Paid (Since Aug 19)", value: fmt(foodFinancials.upfrontPaidTotal) },
    { label: "Food Cost (Sold)", value: fmt(stats.cost) },
    {
      label: "To Break Even (Since Aug 19)",
      value: foodFinancials.breakEvenAchieved ? "RM 0.00" : fmt(foodFinancials.breakEvenNeeded),
      hint: foodFinancials.breakEvenAchieved
        ? `+${fmt(foodFinancials.netSurplus)} surplus`
        : `${foodFinancials.breakEvenPercent}% recovered`,
    },
  ];

  if (stats.hasCost) {
    kpis.push({
      label: stats.costPartial ? "Est. Profit (partial)" : "Est. Profit",
      value: fmt(stats.profit),
    });
  }

  kpis.push({
    label: "Orders & Items",
    value: `${stats.orders} (${stats.itemsSold} sold)`,
  });

  if (stats.giveawayCost > 0) {
    kpis.push({ label: "Giveaways (cost)", value: fmt(stats.giveawayCost) });
  }

  const fmtShortDate = (s: string) =>
    new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const rangeDisplayLabel = customRange
    ? `${fmtShortDate(customRange.from)} – ${fmtShortDate(customRange.to)}`
    : customDate
      ? new Date(customDate + "T00:00:00").toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : RANGES.find((r) => r.key === range)?.label || "Today";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Analytics</h1>
          <p className="text-sm text-ink-muted">
            {customRange
              ? `Showing ${rangeDisplayLabel}.`
              : customDate
                ? `Showing ${new Date(customDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.`
                : "Pick a range to filter revenue, food expenses, and break-even status below."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl bg-surface-alt p-1">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/analytics?range=${r.key}`}
                className={`rounded-lg px-3.5 py-2 text-sm font-bold ${
                  !customDate && !customRange && range === r.key ? "bg-accent text-white" : "text-ink-muted"
                }`}
              >
                {r.label}
              </Link>
            ))}
          </div>
          <DatePicker value={customDate ?? todayInMalaysia()} active={!!customDate} />
          <DateRangePicker
            from={customRange?.from ?? todayInMalaysia()}
            to={customRange?.to ?? todayInMalaysia()}
            active={!!customRange}
          />
          <ExportButton
            transactions={(txns ?? []) as Transaction[]}
            stats={stats}
            foodFinancials={foodFinancials}
            rangeLabel={rangeDisplayLabel}
          />
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-surface p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-muted">{k.label}</div>
              <div className="text-lg font-extrabold text-accent">{k.value}</div>
            </div>
            {k.hint && <div className="mt-1 text-[10px] font-semibold text-ink-muted">{k.hint}</div>}
          </div>
        ))}
      </div>

      {/* Break-Even & Food Expense Tracker Card */}
      <div className="mb-5 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-ink flex items-center gap-1.5">
              <span>⚖️</span> Break-Even & Food Cost Tracker
            </h2>
            <p className="text-xs text-ink-muted">
              Cash paid upfront vs revenue since Aug 19, 2026 (when tracking started) — always the running total, not just this date range.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              foodFinancials.breakEvenAchieved
                ? "bg-success-soft text-success"
                : "border border-gold/40 bg-surface-alt text-gold"
            }`}
          >
            {foodFinancials.breakEvenAchieved
              ? "🎉 Break-Even Reached"
              : `${foodFinancials.breakEvenPercent}% Recovered`}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="mb-1.5 flex justify-between text-xs font-semibold">
            <span className="text-ink-muted">
              Revenue (Since Aug 19): <strong className="text-ink">{fmt(allTimeRevenue)}</strong>
            </span>
            <span className="text-ink-muted">
              Upfront Food Paid (Since Aug 19): <strong className="text-ink">{fmt(foodFinancials.upfrontPaidTotal)}</strong>
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-surface-alt">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                foodFinancials.breakEvenAchieved ? "bg-success" : "bg-accent"
              }`}
              style={{ width: `${foodFinancials.breakEvenPercent}%` }}
            />
          </div>
        </div>

        {/* 4 Summary Stat Boxes */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface-alt/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
              Upfront Food Paid (Since Aug 19)
            </div>
            <div className="text-base font-extrabold text-ink">
              {fmt(foodFinancials.upfrontPaidTotal)}
            </div>
            <div className="mt-0.5 text-[10px] text-ink-muted">Total cash paid for upfront batches since tracking started</div>
          </div>

          <div className="rounded-xl border border-border bg-surface-alt/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
              Food Cost (Sold)
            </div>
            <div className="text-base font-extrabold text-ink">
              {fmt(foodFinancials.totalFoodCostSold)}
            </div>
            <div className="mt-0.5 text-[10px] text-ink-muted">Modal of items sold in this period</div>
          </div>

          <div className="rounded-xl border border-border bg-surface-alt/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
              To Break Even
            </div>
            <div
              className={`text-base font-extrabold ${
                foodFinancials.breakEvenAchieved ? "text-success" : "text-danger"
              }`}
            >
              {foodFinancials.breakEvenAchieved ? "RM 0.00" : fmt(foodFinancials.breakEvenNeeded)}
            </div>
            <div className="mt-0.5 text-[10px] text-ink-muted">
              {foodFinancials.breakEvenAchieved
                ? `+${fmt(foodFinancials.netSurplus)} surplus profit`
                : "Remaining revenue needed"}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface-alt/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
              Unsold Upfront Stock
            </div>
            <div className="text-base font-extrabold text-gold">
              {fmt(foodFinancials.upfrontRemainingStockValue)}
            </div>
            <div className="mt-0.5 text-[10px] text-ink-muted">Value of upfront food on shelf</div>
          </div>
        </div>
      </div>

      {(customRange || (!customDate && range !== "today")) && (
        <div className="mb-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-bold text-ink">Revenue by Day</h3>
          <BarChart data={stats.byDay} prefix="RM" />
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-bold text-ink">Busiest Hours</h3>
        <BarChart data={stats.byHour} prefix="RM" />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <TopItemsPanel byItem={stats.byItem} />

        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-ink">By Category</h3>
          <RankList
            rows={stats.byCategory.map((c) => ({ label: c.name, value: fmt(c.revenue), sortVal: c.revenue }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-ink">Payment Split</h3>
          <RankList
            rows={stats.byPayment.map((p) => ({
              label: (p.name === "Cash" ? "💵 " : p.name === "QR Pay" ? "🔳 " : "🎁 ") + p.name,
              value: `${fmt(p.revenue)} · ${p.count}`,
              sortVal: p.revenue,
            }))}
          />
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h3 className="mb-1 text-sm font-bold text-ink">Not Selling</h3>
          <p className="mb-3 text-xs text-ink-muted">
            Priced items with zero sales in this range — candidates to drop or promote.
          </p>
          <ChipList items={slowMovers} />
        </div>
      </div>
    </div>
  );
}
