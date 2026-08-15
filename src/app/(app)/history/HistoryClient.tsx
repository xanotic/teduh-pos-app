"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { MenuItem, PaymentMethod, Transaction, TransactionItem } from "@/lib/types";
import { fmt } from "@/lib/format";
import { updateTransaction, voidTransaction } from "@/lib/actions/sales";

const PAY_METHODS: PaymentMethod[] = ["Cash", "QR Pay", "Giveaway"];

export function HistoryClient({
  transactions,
  menuItems,
  dateStr,
  isToday,
  isYesterday,
  prevDate,
  nextDate,
}: {
  transactions: Transaction[];
  menuItems: MenuItem[];
  dateStr: string;
  isToday: boolean;
  isYesterday: boolean;
  prevDate: string;
  nextDate: string | null;
}) {
  const total = transactions.reduce((s, t) => s + Number(t.total), 0);
  const router = useRouter();
  const heading = isToday ? "Today's Sales" : isYesterday ? "Yesterday's Sales" : "Sales";

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
        {new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>

      <div className="mb-5 flex items-center justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Total revenue</div>
          <div className="text-2xl font-extrabold text-success">{fmt(total)}</div>
        </div>
        <div className="text-sm text-ink-muted">
          {transactions.length} {transactions.length === 1 ? "transaction" : "transactions"}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {transactions.map((t) => (
          <TxnCard key={t.id} txn={t} menuItems={menuItems} />
        ))}
        {transactions.length === 0 && (
          <p className="text-sm text-ink-muted">
            {isToday ? "No sales recorded yet today." : "No sales recorded on this day."}
          </p>
        )}
      </div>
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

  const time = new Date(txn.ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
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
