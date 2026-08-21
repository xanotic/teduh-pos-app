import type { ConsignmentSettlement, ShelfLifeEntry, Transaction } from "@/lib/types";

export type RangeKey = "today" | "7d" | "30d" | "all";

const MY_OFFSET_MS = 8 * 60 * 60 * 1000;

export function rangeStart(range: RangeKey): Date | null {
  const now = Date.now();
  const myNow = new Date(now + MY_OFFSET_MS);
  const todayDateStr = myNow.toISOString().slice(0, 10);

  if (range === "today") return new Date(todayDateStr + "T00:00:00+08:00");
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
  byItem: { name: string; qty: number; revenue: number; cost: number; hasCost: boolean }[];
  byCategory: { name: string; qty: number; revenue: number }[];
  byPayment: { name: string; revenue: number; count: number }[];
  byDay: { label: string; value: number }[];
  byHour: { label: string; value: number }[];
  byWeekday: { label: string; value: number }[];
}

export interface FoodFinancialStats {
  upfrontPaidTotal: number;
  upfrontRemainingStockValue: number;
  upfrontExpiredLoss: number;
  consignmentPaidTotal: number;
  totalFoodCostSold: number;
  breakEvenTarget: number;
  breakEvenNeeded: number;
  breakEvenPercent: number;
  breakEvenAchieved: boolean;
  netSurplus: number;
}

export function computeFoodFinancials(
  soldFoodCost: number,
  cumulativeUpfrontPaid: number,
  allTimeRevenue: number,
  shelfLifeEntries: ShelfLifeEntry[] = [],
  settlements: ConsignmentSettlement[] = []
): FoodFinancialStats {
  const now = Date.now();
  const myNow = new Date(now + MY_OFFSET_MS);
  const todayDateStr = myNow.toISOString().slice(0, 10);

  const upfrontEntries = shelfLifeEntries.filter((e) => e.payment_type === "upfront");

  // Cash paid upfront, ever — a running ledger, not derived from currently-existing
  // rows, since a batch's row is deleted once it fully sells through (see
  // deductShelfLifeFifo). Break-even has to carry across days, not reset with
  // whatever date range Analytics happens to be showing right now.
  const upfrontPaidTotal = cumulativeUpfrontPaid;

  // Unsold upfront stock still on shelf
  const upfrontRemainingStockValue = upfrontEntries.reduce(
    (sum, e) => sum + e.qty * (e.cost ?? 0),
    0
  );

  // Expired upfront food (lost money)
  const upfrontExpiredLoss = upfrontEntries
    .filter((e) => e.expires_at < todayDateStr)
    .reduce((sum, e) => sum + e.qty * (e.cost ?? 0), 0);

  // Paid consignment settlements
  const consignmentPaidTotal = settlements
    .filter((s) => s.paid)
    .reduce(
      (sum, s) =>
        sum +
        (s.consignment_settlement_items ?? []).reduce(
          (iSum, item) =>
            iSum + (item.delivered_qty - item.remaining_qty) * (item.cost ?? 0),
          0
        ),
      0
    );

  // Break-even target: cash investment in upfront foods, measured against
  // all-time revenue so it's a running "have I earned that cash back yet"
  // status, unaffected by whichever date range is selected above.
  const breakEvenTarget = upfrontPaidTotal;
  const breakEvenNeeded = Math.max(0, breakEvenTarget - allTimeRevenue);
  const breakEvenPercent =
    breakEvenTarget > 0
      ? Math.min(100, Math.round((allTimeRevenue / breakEvenTarget) * 100))
      : 100;
  const breakEvenAchieved = allTimeRevenue >= breakEvenTarget;
  const netSurplus = allTimeRevenue - breakEvenTarget;

  return {
    upfrontPaidTotal,
    upfrontRemainingStockValue,
    upfrontExpiredLoss,
    consignmentPaidTotal,
    totalFoodCostSold: soldFoodCost,
    breakEvenTarget,
    breakEvenNeeded,
    breakEvenPercent,
    breakEvenAchieved,
    netSurplus,
  };
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function computeStats(transactions: Transaction[]): AnalyticsStats {
  let revenue = 0;
  let itemsSold = 0;
  let cost = 0;
  let trackedRevenue = 0;
  let anyCost = false;
  let anyMissingCost = false;
  let giveawayCost = 0;

  const byItem: Record<string, { name: string; qty: number; revenue: number; cost: number; hasCost: boolean }> = {};
  const byCategory: Record<string, { name: string; qty: number; revenue: number }> = {};
  const byPayment: Record<string, { name: string; revenue: number; count: number }> = {};
  const byDay: Record<string, number> = {};
  const byHour = new Array(24).fill(0) as number[];
  const byWeekday = new Array(7).fill(0) as number[];
  const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (const t of transactions) {
    revenue += Number(t.total);
    const pm = t.payment_method || "Unspecified";
    byPayment[pm] ??= { name: pm, revenue: 0, count: 0 };
    byPayment[pm].revenue += Number(t.total);
    byPayment[pm].count += 1;

    // Explicitly compute Malaysia time (UTC+8) for hour and day grouping
    const tsMs = new Date(t.ts).getTime();
    const myDate = new Date(tsMs + MY_OFFSET_MS);
    const dayKey = myDate.toISOString().slice(0, 10); // YYYY-MM-DD
    const hour = myDate.getUTCHours();
    const weekday = myDate.getUTCDay();

    byDay[dayKey] = (byDay[dayKey] || 0) + Number(t.total);
    byHour[hour] += Number(t.total);
    byWeekday[weekday] += Number(t.total);

    for (const line of t.transaction_items) {
      itemsSold += line.qty;
      const lineRevenue = line.price * line.qty;

      byItem[line.name] ??= { name: line.name, qty: 0, revenue: 0, cost: 0, hasCost: false };
      byItem[line.name].qty += line.qty;
      byItem[line.name].revenue += lineRevenue;

      if (typeof line.cost === "number") {
        cost += line.cost * line.qty;
        trackedRevenue += lineRevenue;
        anyCost = true;
        byItem[line.name].cost += line.cost * line.qty;
        byItem[line.name].hasCost = true;
        if (pm === "Giveaway") giveawayCost += line.cost * line.qty;
      } else {
        anyMissingCost = true;
      }

      const cat = line.category || "Other";
      byCategory[cat] ??= { name: cat, qty: 0, revenue: 0 };
      byCategory[cat].qty += line.qty;
      byCategory[cat].revenue += lineRevenue;
    }
  }

  const dayEntries = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));
  const byDayChart = dayEntries.slice(-30).map(([key, value]) => {
    const parts = key.split("-");
    const monthIndex = parseInt(parts[1], 10) - 1;
    const dayNum = parseInt(parts[2], 10);
    return {
      label: `${MONTH_NAMES[monthIndex]} ${dayNum}`,
      value,
    };
  });

  const byHourChart = byHour.map((value, h) => {
    const label = h === 0 ? "12am" : h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`;
    return { label, value };
  });

  const byWeekdayChart = byWeekday.map((value, d) => ({ label: WEEKDAY_NAMES[d], value }));

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
    byWeekday: byWeekdayChart,
  };
}
