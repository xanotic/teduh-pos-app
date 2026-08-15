import { getBusinessContext } from "@/lib/business";
import type { Transaction } from "@/lib/types";
import { HistoryClient } from "./HistoryClient";

export const dynamic = "force-dynamic";

// Malaysia is UTC+8 with no DST — computed explicitly rather than relying on
// the server's local timezone, since Vercel functions run in UTC regardless
// of the configured region.
const MY_OFFSET_MS = 8 * 60 * 60 * 1000;

function todayInMalaysia(): string {
  return new Date(Date.now() + MY_OFFSET_MS).toISOString().slice(0, 10);
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00+08:00");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { supabase, businessId } = await getBusinessContext();
  const { date } = await searchParams;

  const today = todayInMalaysia();
  const dateStr = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;

  const dayStart = new Date(dateStr + "T00:00:00+08:00");
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const { data } = await supabase
    .from("transactions")
    .select("*, transaction_items(*)")
    .eq("business_id", businessId)
    .gte("ts", dayStart.toISOString())
    .lt("ts", dayEnd.toISOString())
    .order("ts", { ascending: false });

  return (
    <HistoryClient
      transactions={(data ?? []) as Transaction[]}
      dateStr={dateStr}
      isToday={dateStr === today}
      isYesterday={dateStr === shiftDate(today, -1)}
      prevDate={shiftDate(dateStr, -1)}
      nextDate={dateStr === today ? null : shiftDate(dateStr, 1)}
    />
  );
}
