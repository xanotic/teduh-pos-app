"use client";

import { useState, useTransition } from "react";
import type { MiscExpense } from "@/lib/types";
import { fmt } from "@/lib/format";
import { addMiscExpense, deleteMiscExpense } from "./actions";

function todayStr() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function MiscClient({ expenses }: { expenses: MiscExpense[] }) {
  const [pending, startTransition] = useTransition();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [spentAt, setSpentAt] = useState(todayStr());
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthTotal = expenses
    .filter((e) => e.spent_at.slice(0, 7) === thisMonth)
    .reduce((s, e) => s + Number(e.amount), 0);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !amount || !spentAt) return;
    startTransition(async () => {
      await addMiscExpense({
        description: description.trim(),
        amount: parseFloat(amount) || 0,
        spentAt,
      });
      setDescription("");
      setAmount("");
      setSpentAt(todayStr());
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-bold text-ink">Miscellaneous</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Log equipment or item purchases for the business — not food stock, just the extra stuff
        (containers, gas, a new blender, etc).
      </p>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">This month</div>
          <div className="text-lg font-extrabold text-danger">{fmt(monthTotal)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">All time</div>
          <div className="text-lg font-extrabold text-ink">{fmt(total)}</div>
        </div>
      </div>

      <form
        onSubmit={handleAdd}
        className="mb-6 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:grid-cols-4 sm:items-end"
      >
        <div className="col-span-2 sm:col-span-2">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            What did you buy?
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. New blender"
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Amount (RM)
          </label>
          <input
            type="number"
            step="0.1"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Date
          </label>
          <input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} className="input" />
        </div>
        <button
          disabled={pending}
          className="col-span-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-4"
        >
          Add expense
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {expenses.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-ink">{e.description}</div>
              <div className="text-xs text-ink-muted">
                {new Date(e.spent_at + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
            <span className="text-sm font-bold text-danger">{fmt(Number(e.amount))}</span>
            <button
              onClick={() =>
                confirmId === e.id
                  ? startTransition(async () => {
                      await deleteMiscExpense(e.id);
                      setConfirmId(null);
                    })
                  : setConfirmId(e.id)
              }
              className={`flex-none rounded-md px-2 py-1 text-xs font-bold ${
                confirmId === e.id ? "bg-danger text-white" : "bg-surface-alt text-danger"
              }`}
            >
              {confirmId === e.id ? "✔" : "✕"}
            </button>
          </div>
        ))}
        {expenses.length === 0 && <p className="text-sm text-ink-muted">No expenses logged yet.</p>}
      </div>
    </div>
  );
}
