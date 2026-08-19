import { getBusinessContext } from "@/lib/business";
import type { DailyBalance, MenuItem, Transaction } from "@/lib/types";
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
  const { supabase, businessId, businessName } = await getBusinessContext();
  const { date } = await searchParams;

  const today = todayInMalaysia();
  const dateStr = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;

  const dayStart = new Date(dateStr + "T00:00:00+08:00");
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const prevDateStr = shiftDate(dateStr, -1);
  const prevDayStart = new Date(prevDateStr + "T00:00:00+08:00");
  const prevDayEnd = new Date(prevDayStart.getTime() + 86400000);

  const [
    { data },
    { data: menu },
    { data: balanceRow },
    { data: prevBalanceRow },
    { data: prevCashTxns },
    { data: business },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, transaction_items(*)")
      .eq("business_id", businessId)
      .gte("ts", dayStart.toISOString())
      .lt("ts", dayEnd.toISOString())
      .order("ts", { ascending: false }),
    supabase.from("menu_items").select("*").eq("business_id", businessId).order("category").order("name"),
    supabase.from("daily_balances").select("*").eq("business_id", businessId).eq("date", dateStr).maybeSingle(),
    supabase.from("daily_balances").select("*").eq("business_id", businessId).eq("date", prevDateStr).maybeSingle(),
    supabase
      .from("transactions")
      .select("total")
      .eq("business_id", businessId)
      .eq("payment_method", "Cash")
      .gte("ts", prevDayStart.toISOString())
      .lt("ts", prevDayEnd.toISOString()),
    supabase.from("businesses").select("boss_whatsapp").eq("id", businessId).single(),
  ]);

  const transactions = (data ?? []) as Transaction[];
  const cashTotal = transactions
    .filter((t) => t.payment_method === "Cash")
    .reduce((s, t) => s + Number(t.total), 0);

  const prevBalance = prevBalanceRow as DailyBalance | null;
  const prevCashTotal = (prevCashTxns ?? []).reduce((s, t) => s + Number(t.total), 0);
  const prevExpectedClosing = (prevBalance?.opening_balance ?? 0) + prevCashTotal;
  const carriedOpeningBalance = prevBalance?.actual_closing ?? prevExpectedClosing;

  const balance = balanceRow as DailyBalance | null;

  return (
    <HistoryClient
      transactions={transactions}
      menuItems={(menu ?? []) as MenuItem[]}
      dateStr={dateStr}
      isToday={dateStr === today}
      isYesterday={dateStr === shiftDate(today, -1)}
      prevDate={shiftDate(dateStr, -1)}
      nextDate={dateStr === today ? null : shiftDate(dateStr, 1)}
      cashTotal={cashTotal}
      openingBalance={balance?.opening_balance ?? carriedOpeningBalance}
      openingBalanceIsSaved={balance != null}
      actualClosing={balance?.actual_closing ?? null}
      businessName={businessName}
      bossWhatsapp={business?.boss_whatsapp ?? ""}
    />
  );
}
