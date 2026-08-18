"use client";

import { useState, useTransition } from "react";
import type { MenuItem, PaymentType, ShelfLifeEntry } from "@/lib/types";
import { fmt } from "@/lib/format";
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

const TABS: { key: PaymentType; label: string; hint: string }[] = [
  {
    key: "consignment",
    label: "Consignment",
    hint: "Supplier is only paid for what sells — unsold/expired stock costs nothing extra.",
  },
  {
    key: "upfront",
    label: "Upfront Payment",
    hint: "Already paid to the supplier regardless of sales — expired stock is a real cash loss.",
  },
];

export function ShelfLifeClient({ entries, menuItems }: { entries: ShelfLifeEntry[]; menuItems: MenuItem[] }) {
  const [tab, setTab] = useState<PaymentType>("consignment");
  const [pending, startTransition] = useTransition();
  const [item, setItem] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [costTouched, setCostTouched] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = entries.filter((e) => e.payment_type === tab);
  const sorted = [...filtered].sort((a, b) => daysLeft(a.expires_at) - daysLeft(b.expires_at));

  const lostAlready = sorted
    .filter((e) => status(daysLeft(e.expires_at)) === "expired")
    .reduce((s, e) => s + (e.cost ?? 0) * e.qty, 0);
  const atRisk = sorted
    .filter((e) => status(daysLeft(e.expires_at)) === "soon")
    .reduce((s, e) => s + (e.cost ?? 0) * e.qty, 0);

  function handleItemChange(v: string) {
    setItem(v);
    if (!costTouched) {
      const match = menuItems.find((m) => m.name.toLowerCase() === v.trim().toLowerCase());
      if (match?.cost != null) setCost(String(match.cost));
    }
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!item.trim() || !date) return;
    startTransition(async () => {
      await addShelfLifeEntry({
        item: item.trim(),
        expiresAt: date,
        notes: notes.trim(),
        paymentType: tab,
        qty: parseInt(qty, 10) || 1,
        cost: cost === "" ? null : parseFloat(cost) || 0,
      });
      setItem("");
      setDate("");
      setNotes("");
      setQty("1");
      setCost("");
      setCostTouched(false);
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-bold text-ink">Item Shelf Life</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Track expiry per batch, split by how the stock is paid for. Sorted soonest-to-expire first.
      </p>

      <div className="mb-4 flex gap-1 rounded-xl bg-surface-alt p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${
              tab === t.key ? "bg-accent text-white" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mb-4 text-xs text-ink-muted">{TABS.find((t) => t.key === tab)?.hint}</p>

      {tab === "upfront" && (lostAlready > 0 || atRisk > 0) && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-danger bg-danger-soft p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-danger">Lost already</div>
            <div className="text-lg font-extrabold text-danger">{fmt(lostAlready)}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface-alt p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-gold">At risk (≤3d)</div>
            <div className="text-lg font-extrabold text-gold">{fmt(atRisk)}</div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="mb-6 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:grid-cols-6 sm:items-end"
      >
        <div className="col-span-2">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Item</label>
          <input
            value={item}
            onChange={(e) => handleItemChange(e.target.value)}
            list="menu-names"
            placeholder="e.g. Tiramisu Cake"
            className="input"
          />
          <datalist id="menu-names">
            {menuItems.map((m) => (
              <option key={m.id} value={m.name} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Qty</label>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            {tab === "upfront" ? "Cost/unit (RM)" : "Cost/unit (optional)"}
          </label>
          <input
            type="number"
            step="0.1"
            value={cost}
            onChange={(e) => {
              setCost(e.target.value);
              setCostTouched(true);
            }}
            className="input"
          />
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
          className="col-span-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-6"
        >
          Add to {TABS.find((t) => t.key === tab)?.label}
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
          const loss = e.payment_type === "upfront" && e.cost != null ? e.cost * e.qty : null;
          return (
            <div key={e.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                {e.initial_qty != null && e.initial_qty > e.qty ? (
                  <>
                    <span className="font-extrabold text-accent">{e.qty}</span>
                    <span className="text-ink-muted font-normal"> / {e.initial_qty} left · </span>
                  </>
                ) : (
                  <span className="font-extrabold text-accent">{e.qty}× </span>
                )}
                {e.item}
              </span>
              {e.notes && <span className="basis-full text-xs text-ink-muted">{e.notes}</span>}
              <span className="text-xs text-ink-muted">
                {new Date(e.expires_at + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[s]}`}>{label}</span>
              {loss != null && s === "expired" && (
                <span className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-bold text-danger">
                  Loss: {fmt(loss)}
                </span>
              )}
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
          <p className="text-sm text-ink-muted">No {TABS.find((t) => t.key === tab)?.label.toLowerCase()} entries yet.</p>
        )}
      </div>
    </div>
  );
}
