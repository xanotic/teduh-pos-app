"use client";

import { useState, useTransition } from "react";
import type { ConsignmentSettlement, MenuItem } from "@/lib/types";
import { fmt } from "@/lib/format";
import { createSettlement, deleteSettlement, markSettlementPaid } from "./actions";

interface DraftItem {
  name: string;
  delivered: string;
  remaining: string;
  cost: string;
  soldOut: boolean;
}

function emptyItem(): DraftItem {
  return { name: "", delivered: "", remaining: "", cost: "", soldOut: false };
}

function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function ConsignmentClient({
  settlements,
  menuItems,
}: {
  settlements: ConsignmentSettlement[];
  menuItems: MenuItem[];
}) {
  const [pending, startTransition] = useTransition();
  const [settledAt, setSettledAt] = useState(nowLocalInput());
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  function updateItem(idx: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function handleNameChange(idx: number, name: string) {
    const match = menuItems.find((m) => m.name.toLowerCase() === name.trim().toLowerCase());
    updateItem(idx, { name, cost: match?.cost != null ? String(match.cost) : items[idx].cost });
  }

  function addRow() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const rows = items
    .filter((it) => it.name.trim())
    .map((it) => {
      const delivered = parseInt(it.delivered, 10) || 0;
      const remaining = it.soldOut ? 0 : parseInt(it.remaining, 10) || 0;
      const sold = Math.max(delivered - remaining, 0);
      const cost = it.cost === "" ? null : parseFloat(it.cost) || 0;
      const owed = cost != null ? cost * sold : null;
      return { name: it.name.trim(), delivered, remaining, sold, cost, owed, soldOut: it.soldOut };
    });

  const totalOwed = rows.reduce((s, r) => s + (r.owed ?? 0), 0);
  const anyMissingCost = rows.some((r) => r.cost == null);

  function handleSave() {
    if (!rows.length) return;
    setError(null);
    startTransition(async () => {
      try {
        await createSettlement({
          settledAt: new Date(settledAt).toISOString(),
          items: rows.map((r) => ({
            name: r.name,
            deliveredQty: r.delivered,
            remainingQty: r.remaining,
            cost: r.cost,
          })),
        });
        setItems([emptyItem()]);
        setSettledAt(nowLocalInput());
        setSavedMsg("Settlement saved.");
        setTimeout(() => setSavedMsg(null), 2500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save settlement.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-bold text-ink">Consignment Payout</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Log tonight&apos;s baki (remaining stock) per supplier item — it works out how many sold and
        how much you owe, so you&apos;re not doing it by hand.
      </p>

      <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Baki as of
          </label>
          <input
            type="datetime-local"
            value={settledAt}
            onChange={(e) => setSettledAt(e.target.value)}
            className="input max-w-xs"
          />
        </div>

        <div className="flex flex-col gap-2">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-2 rounded-xl bg-bg p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <div className="col-span-2 sm:col-span-1">
                <input
                  value={it.name}
                  onChange={(e) => handleNameChange(idx, e.target.value)}
                  list="consignment-menu-names"
                  placeholder="e.g. Roti Golok"
                  className="input"
                />
                <datalist id="consignment-menu-names">
                  {menuItems.map((m) => (
                    <option key={m.id} value={m.name} />
                  ))}
                </datalist>
              </div>
              <input
                type="number"
                min={0}
                value={it.delivered}
                onChange={(e) => updateItem(idx, { delivered: e.target.value })}
                placeholder="Delivered"
                className="input"
              />
              <input
                type="number"
                min={0}
                value={it.soldOut ? "" : it.remaining}
                disabled={it.soldOut}
                onChange={(e) => updateItem(idx, { remaining: e.target.value })}
                placeholder={it.soldOut ? "Sold out" : "Remaining"}
                className="input disabled:opacity-50"
              />
              <input
                type="number"
                step="0.1"
                min={0}
                value={it.cost}
                onChange={(e) => updateItem(idx, { cost: e.target.value })}
                placeholder="Cost/unit"
                className="input"
              />
              <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                <button
                  onClick={() => updateItem(idx, { soldOut: !it.soldOut, remaining: "" })}
                  className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold sm:flex-none ${
                    it.soldOut ? "bg-danger text-white" : "border border-border text-ink-muted"
                  }`}
                >
                  Sold out
                </button>
                <button
                  onClick={() => removeRow(idx)}
                  className="rounded-lg border border-border px-2 py-2 text-xs font-bold text-danger"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="mt-3 rounded-lg border border-accent px-3 py-2 text-xs font-bold text-accent"
        >
          + Add item
        </button>

        {rows.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-bg p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">To pay suppliers</span>
              <span className="text-lg font-extrabold text-accent">{fmt(totalOwed)}</span>
            </div>
            {anyMissingCost && (
              <p className="text-xs text-gold">Some items have no cost/unit — their payout isn&apos;t included above.</p>
            )}
          </div>
        )}

        <button
          disabled={pending || rows.length === 0}
          onClick={handleSave}
          className="mt-4 w-full rounded-xl bg-accent py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          Save Settlement
        </button>
        {error && <p className="mt-2 text-xs font-semibold text-danger">{error}</p>}
        {savedMsg && <p className="mt-2 text-xs font-semibold text-success">{savedMsg}</p>}
      </div>

      <h2 className="mb-3 text-sm font-bold text-ink">Past Settlements</h2>
      <div className="flex flex-col gap-3">
        {settlements.map((s) => (
          <SettlementCard key={s.id} settlement={s} />
        ))}
        {settlements.length === 0 && <p className="text-sm text-ink-muted">No settlements logged yet.</p>}
      </div>
    </div>
  );
}

function SettlementCard({ settlement }: { settlement: ConsignmentSettlement }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const rows = settlement.consignment_settlement_items.map((it) => {
    const sold = Math.max(it.delivered_qty - it.remaining_qty, 0);
    const owed = it.cost != null ? it.cost * sold : null;
    return { ...it, sold, owed };
  });
  const total = rows.reduce((s, r) => s + (r.owed ?? 0), 0);

  const label = new Date(settlement.settled_at).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <div className="text-sm font-bold text-ink">Baki — {label}</div>
          <div className="text-xs text-ink-muted">{rows.length} item{rows.length === 1 ? "" : "s"}</div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              settlement.paid ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
            }`}
          >
            {settlement.paid ? "Paid" : "Owing " + fmt(total)}
          </span>
          <span className="text-ink-muted">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex flex-col gap-1.5">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">
                  {r.name}
                  <span className="ml-2 text-xs text-ink-muted">
                    {r.remaining_qty === 0 && r.delivered_qty > 0 ? "sold out" : `${r.remaining_qty} left`} · sold{" "}
                    {r.sold}
                  </span>
                </span>
                <span className="font-bold text-ink">{r.owed != null ? fmt(r.owed) : "—"}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm font-bold text-ink">
            <span>Total owed</span>
            <span>{fmt(total)}</span>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              disabled={pending}
              onClick={() => startTransition(() => markSettlementPaid(settlement.id, !settlement.paid))}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                settlement.paid
                  ? "border border-border text-ink-muted"
                  : "bg-success text-white"
              }`}
            >
              {settlement.paid ? "Mark unpaid" : "Mark as paid"}
            </button>
            <button
              disabled={pending}
              onClick={() =>
                confirmDelete
                  ? startTransition(async () => {
                      await deleteSettlement(settlement.id);
                      setConfirmDelete(false);
                    })
                  : setConfirmDelete(true)
              }
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                confirmDelete ? "bg-danger text-white" : "border border-danger text-danger"
              }`}
            >
              {confirmDelete ? "Tap again to delete" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
