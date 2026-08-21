"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { MenuItem, PaymentMethod, Transaction, TransactionItem } from "@/lib/types";
import { fmt } from "@/lib/format";
import { computeStats } from "@/lib/analytics";
import { updateTransaction, voidTransaction } from "@/lib/actions/sales";
import { setActualClosing, setOpeningBalance } from "./tillActions";

const PAY_METHODS: PaymentMethod[] = ["Cash", "QR Pay", "Giveaway"];

export function HistoryClient({
  transactions,
  menuItems,
  dateStr,
  isToday,
  isYesterday,
  prevDate,
  nextDate,
  cashTotal,
  openingBalance,
  openingBalanceIsSaved,
  actualClosing,
  businessName,
  bossWhatsapp,
}: {
  transactions: Transaction[];
  menuItems: MenuItem[];
  dateStr: string;
  isToday: boolean;
  isYesterday: boolean;
  prevDate: string;
  nextDate: string | null;
  cashTotal: number;
  openingBalance: number;
  openingBalanceIsSaved: boolean;
  actualClosing: number | null;
  businessName: string;
  bossWhatsapp: string;
}) {
  const total = transactions.reduce((s, t) => s + Number(t.total), 0);
  const router = useRouter();
  const heading = isToday ? "Today's Sales" : isYesterday ? "Yesterday's Sales" : "Sales";

  const [methodFilter, setMethodFilter] = useState<PaymentMethod | "All">("All");
  const [copied, setCopied] = useState(false);
  const filteredTransactions =
    methodFilter === "All" ? transactions : transactions.filter((t) => t.payment_method === methodFilter);
  const filteredTotal = filteredTransactions.reduce((s, t) => s + Number(t.total), 0);

  const stats = computeStats(transactions);
  const cash = stats.byPayment.find((p) => p.name === "Cash")?.revenue ?? 0;
  const qr = stats.byPayment.find((p) => p.name === "QR Pay")?.revenue ?? 0;
  const giveaway = stats.byPayment.find((p) => p.name === "Giveaway");
  const dateLabel = new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  function buildReportText() {
    const lines = [
      `📊 ${businessName} — Daily Report`,
      dateLabel,
      "",
      `💰 Total Sales: ${fmt(stats.revenue)}`,
      `💵 Cash: ${fmt(cash)}`,
      `🔳 QR Pay: ${fmt(qr)}`,
      `📈 Est. Profit${stats.costPartial ? " (partial)" : ""}: ${stats.hasCost ? fmt(stats.profit) : "— (no cost set)"}`,
      `🧾 Orders: ${stats.orders}`,
      `🎁 Giveaways: ${giveaway?.count ?? 0}${giveaway && giveaway.revenue > 0 ? ` (${fmt(giveaway.revenue)})` : ""}`,
    ];
    return lines.join("\n");
  }

  function sendReport() {
    const text = encodeURIComponent(buildReportText());
    const url = bossWhatsapp ? `https://wa.me/${bossWhatsapp}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  }

  function copyReport() {
    navigator.clipboard.writeText(buildReportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 flex items-center gap-2">
        <Link
          href={`/history?date=${prevDate}`}
          aria-label="Previous day"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-border bg-surface text-lg font-bold text-ink"
        >
          ‹
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-ink">{heading}</h1>
        </div>
        {nextDate ? (
          <Link
            href={`/history?date=${nextDate}`}
            aria-label="Next day"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-border bg-surface text-lg font-bold text-ink"
          >
            ›
          </Link>
        ) : (
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-border bg-surface text-lg font-bold text-ink-muted">
            ›
          </span>
        )}
        <input
          type="date"
          defaultValue={dateStr}
          onChange={(e) => e.target.value && router.push(`/history?date=${e.target.value}`)}
          className="flex-none rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink-muted"
        />
      </div>
      <p className="mb-4 text-sm text-ink-muted">
        {new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>

      <div className="mb-3 flex items-center justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Total revenue</div>
          <div className="text-2xl font-extrabold text-success">{fmt(total)}</div>
        </div>
        <div className="text-sm text-ink-muted">
          {transactions.length} {transactions.length === 1 ? "transaction" : "transactions"}
        </div>
      </div>

      <div className="mb-5 flex gap-2">
        <button
          onClick={sendReport}
          disabled={transactions.length === 0}
          className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          📤 Send Daily Report
        </button>
        <button
          onClick={copyReport}
          disabled={transactions.length === 0}
          className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-ink-muted disabled:opacity-40"
        >
          {copied ? "Copied ✓" : "📋 Copy"}
        </button>
      </div>

      <TillCard
        dateStr={dateStr}
        cashTotal={cashTotal}
        openingBalance={openingBalance}
        openingBalanceIsSaved={openingBalanceIsSaved}
        actualClosing={actualClosing}
      />

      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-1 gap-1 rounded-xl bg-surface-alt p-1">
          {(["All", "Cash", "QR Pay", "Giveaway"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold ${
                methodFilter === m ? "bg-accent text-white" : "text-ink-muted hover:text-ink"
              }`}
            >
              {m === "QR Pay" ? "🔳 QR" : m === "Cash" ? "💵 Cash" : m === "Giveaway" ? "🎁 Giveaway" : "All"}
            </button>
          ))}
        </div>
      </div>
      {methodFilter !== "All" && (
        <p className="mb-3 text-xs text-ink-muted">
          {filteredTransactions.length} {filteredTransactions.length === 1 ? "transaction" : "transactions"} ·{" "}
          <span className="font-bold text-ink">{fmt(filteredTotal)}</span>
        </p>
      )}

      <div className="flex flex-col gap-2">
        {filteredTransactions.map((t) => (
          <TxnCard key={t.id} txn={t} menuItems={menuItems} />
        ))}
        {filteredTransactions.length === 0 && (
          <p className="text-sm text-ink-muted">
            {transactions.length === 0
              ? isToday
                ? "No sales recorded yet today."
                : "No sales recorded on this day."
              : `No ${methodFilter} transactions on this day.`}
          </p>
        )}
      </div>
    </div>
  );
}

function TillCard({
  dateStr,
  cashTotal,
  openingBalance,
  openingBalanceIsSaved,
  actualClosing,
}: {
  dateStr: string;
  cashTotal: number;
  openingBalance: number;
  openingBalanceIsSaved: boolean;
  actualClosing: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [openingInput, setOpeningInput] = useState(String(openingBalance));
  const [openingEditing, setOpeningEditing] = useState(false);
  const [actualInput, setActualInput] = useState(actualClosing != null ? String(actualClosing) : "");
  const [actualEditing, setActualEditing] = useState(false);

  const opening = parseFloat(openingInput) || 0;
  const expectedClosing = opening + cashTotal;
  const actual = actualInput === "" ? null : parseFloat(actualInput) || 0;
  const variance = actual != null ? actual - expectedClosing : null;

  return (
    <div className="mb-5 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">Cash Till</h2>
        {!openingBalanceIsSaved && <span className="text-[11px] text-ink-muted">Carried from previous day — tap to confirm</span>}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Opening</div>
          {openingEditing ? (
            <input
              type="number"
              step="0.1"
              autoFocus
              value={openingInput}
              onChange={(e) => setOpeningInput(e.target.value)}
              onBlur={() => {
                setOpeningEditing(false);
                startTransition(() => setOpeningBalance(dateStr, parseFloat(openingInput) || 0));
              }}
              className="input mt-1 text-center text-sm font-bold"
            />
          ) : (
            <button
              onClick={() => setOpeningEditing(true)}
              className="mt-1 block w-full rounded-lg border border-border bg-bg py-1.5 text-sm font-bold text-ink"
            >
              {fmt(opening)}
            </button>
          )}
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Cash Sales</div>
          <div className="mt-1 rounded-lg py-1.5 text-sm font-bold text-success">{fmt(cashTotal)}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Expected</div>
          <div className="mt-1 rounded-lg py-1.5 text-sm font-bold text-ink">{fmt(expectedClosing)}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
        <div className="text-xs text-ink-muted">Actual counted at close-out</div>
        {actualEditing ? (
          <input
            type="number"
            step="0.1"
            autoFocus
            value={actualInput}
            onChange={(e) => setActualInput(e.target.value)}
            onBlur={() => {
              setActualEditing(false);
              if (actualInput !== "") startTransition(() => setActualClosing(dateStr, parseFloat(actualInput) || 0));
            }}
            className="input w-28 text-right text-sm font-bold"
          />
        ) : (
          <button
            onClick={() => setActualEditing(true)}
            className="rounded-lg border border-border bg-bg px-3 py-1.5 text-sm font-bold text-ink"
          >
            {actual != null ? fmt(actual) : "Enter count"}
          </button>
        )}
      </div>

      {variance != null && Math.abs(variance) > 0.01 && (
        <p className={`mt-2 text-xs font-bold ${variance > 0 ? "text-success" : "text-danger"}`}>
          {variance > 0 ? `Over by ${fmt(variance)}` : `Short by ${fmt(Math.abs(variance))}`}
        </p>
      )}
      {variance != null && Math.abs(variance) <= 0.01 && (
        <p className="mt-2 text-xs font-bold text-success">Till balances exactly.</p>
      )}
      {pending && <p className="mt-1 text-[11px] text-ink-muted">Saving…</p>}
    </div>
  );
}

function TxnCard({ txn, menuItems }: { txn: Transaction; menuItems: MenuItem[] }) {
  const [editing, setEditing] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [pending, startTransition] = useTransition();
  const [draftItems, setDraftItems] = useState<TransactionItem[]>(txn.transaction_items);
  const [draftPayment, setDraftPayment] = useState<PaymentMethod>(txn.payment_method);
  const [addSelect, setAddSelect] = useState("");

  function addItem() {
    const mi = menuItems.find((m) => m.id === addSelect);
    if (!mi) return;
    setDraftItems((prev) => {
      const existing = prev.find((l) => l.name === mi.name);
      if (existing) {
        return prev.map((l) => (l.name === mi.name ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        {
          id: `new-${mi.id}-${Date.now()}`,
          transaction_id: txn.id,
          name: mi.name,
          category: mi.category,
          price: mi.price,
          cost: mi.cost,
          qty: 1,
        },
      ];
    });
    setAddSelect("");
  }

  const time = new Date(txn.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const draftTotal = draftItems.reduce((s, l) => s + l.price * l.qty, 0);

  if (editing) {
    return (
      <div className="rounded-xl border-[1.5px] border-accent bg-surface p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
          <span>{time} · editing</span>
          <span className="text-sm font-bold text-ink">{fmt(draftTotal)}</span>
        </div>

        <div className="flex flex-col gap-2">
          {draftItems.map((line, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-lg bg-bg px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-semibold">{line.name}</div>
                <div className="text-xs text-ink-muted">{fmt(line.price)} each</div>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-1">
                <button
                  onClick={() =>
                    setDraftItems((prev) =>
                      prev
                        .map((l, i) => (i === idx ? { ...l, qty: l.qty - 1 } : l))
                        .filter((l) => l.qty > 0)
                    )
                  }
                  className="h-6 w-6 rounded-full bg-surface-alt text-sm font-bold"
                >
                  −
                </button>
                <span className="w-4 text-center text-sm font-bold">{line.qty}</span>
                <button
                  onClick={() =>
                    setDraftItems((prev) => prev.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l)))
                  }
                  className="h-6 w-6 rounded-full bg-surface-alt text-sm font-bold"
                >
                  +
                </button>
              </div>
              <span className="w-14 text-right text-sm font-bold">{fmt(line.price * line.qty)}</span>
            </div>
          ))}
          {draftItems.length === 0 && (
            <p className="text-xs text-ink-muted">No items left — Cancel and Void instead.</p>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <select
            value={addSelect}
            onChange={(e) => setAddSelect(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 py-2 text-sm text-ink"
          >
            <option value="">Add an item…</option>
            {menuItems
              .filter((m) => m.price > 0)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {fmt(m.price)}
                </option>
              ))}
          </select>
          <button
            onClick={addItem}
            disabled={!addSelect}
            className="flex-none rounded-lg border border-accent px-3 py-2 text-sm font-bold text-accent disabled:opacity-40"
          >
            + Add
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {PAY_METHODS.map((pm) => (
            <button
              key={pm}
              onClick={() => setDraftPayment(pm)}
              className={`rounded-lg py-2 text-xs font-bold text-white ${
                pm === "Cash" ? "bg-success" : pm === "QR Pay" ? "bg-gold" : "bg-accent"
              } ${draftPayment === pm ? "opacity-100" : "opacity-40"}`}
            >
              {pm === "Cash" ? "💵 Cash" : pm === "QR Pay" ? "🔳 QR Pay" : "🎁 Giveaway"}
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if (!draftItems.length) return;
                await updateTransaction(
                  txn.id,
                  draftPayment,
                  draftItems.map(({ name, category, price, cost, qty }) => ({ name, category, price, cost, qty }))
                );
                setEditing(false);
              })
            }
            className="rounded-lg border border-accent px-4 py-2 text-sm font-bold text-accent disabled:opacity-50"
          >
            Save Changes
          </button>
          <button
            onClick={() => {
              setDraftItems(txn.transaction_items);
              setDraftPayment(txn.payment_method);
              setEditing(false);
            }}
            className="rounded-lg border border-border px-4 py-2 text-sm font-bold text-ink-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>
          {time}
          <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 font-bold text-accent">
            {txn.payment_method === "Cash" ? "💵 Cash" : txn.payment_method === "QR Pay" ? "🔳 QR" : "🎁 Giveaway"}
          </span>
        </span>
        <span className="text-sm font-bold text-ink">{fmt(Number(txn.total))}</span>
      </div>
      <div className="mt-1 text-sm text-ink-muted">
        {txn.transaction_items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => setEditing(true)}
          className="rounded-md border border-border px-2.5 py-1 text-xs font-bold text-ink-muted"
        >
          Edit
        </button>
        <button
          disabled={pending}
          onClick={() =>
            confirmVoid
              ? startTransition(async () => {
                  await voidTransaction(txn.id);
                })
              : setConfirmVoid(true)
          }
          className={`rounded-md border px-2.5 py-1 text-xs font-bold ${
            confirmVoid ? "border-danger bg-danger text-white" : "border-danger text-danger"
          }`}
        >
          {confirmVoid ? "Tap again to void" : "Void"}
        </button>
      </div>
    </div>
  );
}
