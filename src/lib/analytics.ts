import type { Transaction } from "@/lib/types";

export type RangeKey = "today" | "7d" | "30d" | "all";

export function rangeStart(range: RangeKey): Date | null {
  const now = new Date();
  if (range === "today") return new Date(now.setHours(0, 0, 0, 0));
  if (range === "7d") return new Date(Date.now() - 7 * 86400000);
  if (range === "30d") return new Date(Date.now() - 30 * 86400000);
  return null;
}

export interface AnalyticsStats {
  revenue: number;
  orders: number;
  itemsSold: number;
  avgOrder: number;
  cost: number;
  trackedRevenue: number;
  profit: number;
  hasCost: boolean;
  costPartial: boolean;
  giveawayCost: number;
  byItem: { name: string; qty: number; revenue: number }[];
  byCategory: { name: string; qty: number; revenue: number }[];
  byPayment: { name: string; revenue: number; count: number }[];
  byDay: { label: string; value: number }[];
  byHour: { label: string; value: number }[];
}

export function computeStats(transactions: Transaction[]): AnalyticsStats {
  let revenue = 0;
  let itemsSold = 0;
  let cost = 0;
  let trackedRevenue = 0;
  let anyCost = false;
  let anyMissingCost = false;
  let giveawayCost = 0;

  const byItem: Record<string, { name: string; qty: number; revenue: number }> = {};
  const byCategory: Record<string, { name: string; qty: number; revenue: number }> = {};
  const byPayment: Record<string, { name: string; revenue: number; count: number }> = {};
  const byDay: Record<string, number> = {};
  const byHour = new Array(24).fill(0) as number[];

  for (const t of transactions) {
    revenue += Number(t.total);
    const pm = t.payment_method || "Unspecified";
    byPayment[pm] ??= { name: pm, revenue: 0, count: 0 };
    byPayment[pm].revenue += Number(t.total);
    byPayment[pm].count += 1;

    const d = new Date(t.ts);
    const dayKey = d.toDateString();
    byDay[dayKey] = (byDay[dayKey] || 0) + Number(t.total);
    byHour[d.getHours()] += Number(t.total);

    for (const line of t.transaction_items) {
      itemsSold += line.qty;
      const lineRevenue = line.price * line.qty;

      if (typeof line.cost === "number") {
        cost += line.cost * line.qty;
        trackedRevenue += lineRevenue;
        anyCost = true;
        if (pm === "Giveaway") giveawayCost += line.cost * line.qty;
      } else {
        anyMissingCost = true;
      }

      byItem[line.name] ??= { name: line.name, qty: 0, revenue: 0 };
      byItem[line.name].qty += line.qty;
      byItem[line.name].revenue += lineRevenue;

      const cat = line.category || "Other";
      byCategory[cat] ??= { name: cat, qty: 0, revenue: 0 };
      byCategory[cat].qty += line.qty;
      byCategory[cat].revenue += lineRevenue;
    }
  }

  const dayEntries = Object.entries(byDay).sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());
  const byDayChart = dayEntries.slice(-30).map(([key, value]) => ({
    label: new Date(key).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    value,
  }));

  const byHourChart = byHour.map((value, h) => ({
    label: h === 0 ? "12am" : h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`,
    value,
  }));

  return {
    revenue,
    orders: transactions.length,
    itemsSold,
    avgOrder: transactions.length ? revenue / transactions.length : 0,
    cost,
    trackedRevenue,
    profit: trackedRevenue - cost,
    hasCost: anyCost,
    costPartial: anyCost && anyMissingCost,
    giveawayCost,
    byItem: Object.values(byItem),
    byCategory: Object.values(byCategory).sort((a, b) => b.revenue - a.revenue),
    byPayment: Object.values(byPayment).sort((a, b) => b.revenue - a.revenue),
    byDay: byDayChart,
    byHour: byHourChart,
  };
}
