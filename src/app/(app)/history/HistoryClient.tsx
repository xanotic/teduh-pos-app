"use client";

import { useState, useTransition } from "react";
import type { PaymentMethod, Transaction, TransactionItem } from "@/lib/types";
import { fmt } from "@/lib/format";
import { updateTransaction, voidTransaction } from "@/lib/actions/sales";

const PAY_METHODS: PaymentMethod[] = ["Cash", "QR Pay", "Giveaway"];

export function HistoryClient({ transactions }: { transactions: Transaction[] }) {
  const total = transactions.reduce((s, t) => s + Number(t.total), 0);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-bold text-stone-900">Today&apos;s Sales</h1>
      <p className="mb-4 text-sm text-stone-500">
        {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </p>

      <div className="mb-5 flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-stone-400">Total revenue</div>
          <div className="text-2xl font-extrabold text-emerald-700">{fmt(total)}</div>
        </div>
        <div className="text-sm text-stone-400">
          {transactions.length} {transactions.length === 1 ? "transaction" : "transactions"}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {transactions.map((t) => (
          <TxnCard key={t.id} txn={t} />
        ))}
        {transactions.length === 0 && (
          <p className="text-sm text-stone-400">No sales recorded yet today.</p>
        )}
      </div>
    </div>
  );
}

function TxnCard({ txn }: { txn: Transaction }) {
  const [editing, setEditing] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [pending, startTransition] = useTransition();
  const [draftItems, setDraftItems] = useState<TransactionItem[]>(txn.transaction_items);
  const [draftPayment, setDraftPayment] = useState<PaymentMethod>(txn.payment_method);

  const time = new Date(txn.ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const draftTotal = draftItems.reduce((s, l) => s + l.price * l.qty, 0);

  if (editing) {
    return (
      <div className="rounded-xl border-[1.5px] border-rose-800 bg-white p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-stone-400">
          <span>{time} · editing</span>
          <span className="text-sm font-bold text-stone-800">{fmt(draftTotal)}</span>
        </div>

        <div className="flex flex-col gap-2">
          {draftItems.map((line, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-semibold">{line.name}</div>
                <div className="text-xs text-stone-400">{fmt(line.price)} each</div>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-1">
                <button
                  onClick={() =>
                    setDraftItems((prev) =>
                      prev
                        .map((l, i) => (i === idx ? { ...l, qty: l.qty - 1 } : l))
                        .filter((l) => l.qty > 0)
                    )
                  }
                  className="h-6 w-6 rounded-full bg-stone-100 text-sm font-bold"
                >
                  −
                </button>
                <span className="w-4 text-center text-sm font-bold">{line.qty}</span>
                <button
                  onClick={() =>
                    setDraftItems((prev) => prev.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l)))
                  }
                  className="h-6 w-6 rounded-full bg-stone-100 text-sm font-bold"
                >
                  +
                </button>
              </div>
              <span className="w-14 text-right text-sm font-bold">{fmt(line.price * line.qty)}</span>
            </div>
          ))}
          {draftItems.length === 0 && (
            <p className="text-xs text-stone-400">No items left — Cancel and Void instead.</p>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {PAY_METHODS.map((pm) => (
            <button
              key={pm}
              onClick={() => setDraftPayment(pm)}
              className={`rounded-lg py-2 text-xs font-bold text-white ${
                pm === "Cash" ? "bg-emerald-700" : pm === "QR Pay" ? "bg-amber-600" : "bg-rose-900"
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
            className="rounded-lg border border-rose-800 px-4 py-2 text-sm font-bold text-rose-900 disabled:opacity-50"
          >
            Save Changes
          </button>
          <button
            onClick={() => {
              setDraftItems(txn.transaction_items);
              setDraftPayment(txn.payment_method);
              setEditing(false);
            }}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-bold text-stone-500"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="flex items-center justify-between text-xs text-stone-400">
        <span>
          {time}
          <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 font-bold text-rose-800">
            {txn.payment_method === "Cash" ? "💵 Cash" : txn.payment_method === "QR Pay" ? "🔳 QR" : "🎁 Giveaway"}
          </span>
        </span>
        <span className="text-sm font-bold text-stone-800">{fmt(Number(txn.total))}</span>
      </div>
      <div className="mt-1 text-sm text-stone-600">
        {txn.transaction_items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => setEditing(true)}
          className="rounded-md border border-stone-300 px-2.5 py-1 text-xs font-bold text-stone-600"
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
            confirmVoid ? "border-red-600 bg-red-600 text-white" : "border-red-300 text-red-600"
          }`}
        >
          {confirmVoid ? "Tap again to void" : "Void"}
        </button>
      </div>
    </div>
  );
}
