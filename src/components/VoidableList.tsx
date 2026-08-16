"use client";

import { useState, useTransition } from "react";
import type { Transaction } from "@/lib/types";
import { fmt } from "@/lib/format";
import { voidTransaction } from "@/lib/actions/sales";

export function VoidableList({
  transactions,
  emptyLabel,
  showNote,
}: {
  transactions: Transaction[];
  emptyLabel: string;
  showNote?: boolean;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (!transactions.length) {
    return <p className="text-sm text-ink-muted">{emptyLabel}</p>;
  }

  const sorted = [...transactions].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  const groups: { dayKey: string; label: string; items: Transaction[] }[] = [];
  for (const t of sorted) {
    const d = new Date(t.ts);
    const dayKey = d.toDateString();
    let group = groups.find((g) => g.dayKey === dayKey);
    if (!group) {
      group = {
        dayKey,
        label: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
        items: [],
      };
      groups.push(group);
    }
    group.items.push(t);
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => {
        const dayTotal = g.items.reduce((s, t) => s + Number(t.total), 0);
        return (
          <div key={g.dayKey}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">{g.label}</h3>
              <span className="text-xs font-bold text-ink-muted">{fmt(dayTotal)}</span>
            </div>
            <div className="flex flex-col gap-2">
              {g.items.map((t) => {
                const time = new Date(t.ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                const itemsStr = t.transaction_items.map((i) => `${i.qty}× ${i.name}`).join(", ");

                return (
                  <div key={t.id} className="rounded-xl border border-border bg-surface p-3">
                    <div className="flex items-center justify-between text-xs text-ink-muted">
                      <span>
                        {time}
                        {t.payment_method && (
                          <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 font-bold text-accent">
                            {t.payment_method === "Cash" ? "💵 Cash" : t.payment_method === "QR Pay" ? "🔳 QR" : "🎁 Giveaway"}
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-bold text-ink">{fmt(Number(t.total))}</span>
                    </div>
                    <div className="mt-1 text-sm text-ink-muted">
                      {itemsStr}
                      {showNote && t.note ? ` — ${t.note}` : ""}
                    </div>
                    <button
                      onClick={() =>
                        confirmId === t.id
                          ? startTransition(async () => {
                              await voidTransaction(t.id);
                              setConfirmId(null);
                            })
                          : setConfirmId(t.id)
                      }
                      className={`mt-2 rounded-md border px-2.5 py-1 text-xs font-bold ${
                        confirmId === t.id
                          ? "border-danger bg-danger text-white"
                          : "border-danger text-danger"
                      }`}
                    >
                      {confirmId === t.id ? "Tap again to void" : "Void"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
