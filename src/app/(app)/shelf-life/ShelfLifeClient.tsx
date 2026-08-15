"use client";

import { useState, useTransition } from "react";
import type { ShelfLifeEntry } from "@/lib/types";
import { addShelfLifeEntry, deleteShelfLifeEntry } from "./actions";

function daysLeft(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr + "T00:00:00");
  return Math.round((exp.getTime() - today.getTime()) / 86400000);
}

function status(days: number): "expired" | "soon" | "ok" {
  if (days < 0) return "expired";
  if (days <= 3) return "soon";
  return "ok";
}

const STATUS_STYLE = {
  expired: "bg-danger-soft text-danger",
  soon: "bg-surface-alt text-gold",
  ok: "bg-success-soft text-success",
};

export function ShelfLifeClient({ entries, menuNames }: { entries: ShelfLifeEntry[]; menuNames: string[] }) {
  const [pending, startTransition] = useTransition();
  const [item, setItem] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const sorted = [...entries].sort((a, b) => daysLeft(a.expires_at) - daysLeft(b.expires_at));

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!item.trim() || !date) return;
    startTransition(async () => {
      await addShelfLifeEntry({ item: item.trim(), expiresAt: date, notes: notes.trim() });
      setItem("");
      setDate("");
      setNotes("");
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-bold text-ink">Item Shelf Life</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Track expiry per batch. Sorted soonest-to-expire first — update whenever new stock comes in.
      </p>

      <form
        onSubmit={handleAdd}
        className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:grid-cols-4 sm:items-end"
      >
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Item</label>
          <input
            value={item}
            onChange={(e) => setItem(e.target.value)}
            list="menu-names"
            placeholder="e.g. Tiramisu Cake"
            className="input"
          />
          <datalist id="menu-names">
            {menuNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Expiration Date
          </label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Notes
          </label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. batch of 10"
            className="input"
          />
        </div>
        <button
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {sorted.map((e) => {
          const d = daysLeft(e.expires_at);
          const s = status(d);
          const label =
            s === "expired"
              ? `Expired ${Math.abs(d)}d ago`
              : s === "soon"
                ? d === 0
                  ? "Expires today"
                  : `${d}d left`
                : `${d}d left`;
          return (
            <div key={e.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{e.item}</span>
              {e.notes && <span className="basis-full text-xs text-ink-muted">{e.notes}</span>}
              <span className="text-xs text-ink-muted">
                {new Date(e.expires_at + "T00:00:00").toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[s]}`}>{label}</span>
              <button
                onClick={() =>
                  confirmId === e.id
                    ? startTransition(async () => {
                        await deleteShelfLifeEntry(e.id);
                        setConfirmId(null);
                      })
                    : setConfirmId(e.id)
                }
                className={`rounded-md px-2 py-1 text-xs font-bold ${
                  confirmId === e.id ? "bg-danger text-white" : "bg-surface-alt text-danger"
                }`}
              >
                {confirmId === e.id ? "✔" : "✕"}
              </button>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-sm text-ink-muted">No shelf-life entries yet. Add one above whenever new stock comes in.</p>
        )}
      </div>
    </div>
  );
}
