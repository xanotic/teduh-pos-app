"use client";

import { useMemo, useState, useTransition } from "react";
import type { ConsignmentSettlement, MenuItem, ShelfLifeEntry } from "@/lib/types";
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
  shelfLifeEntries = [],
  posSalesMap = {},
  lastSettledAt = null,
}: {
  settlements: ConsignmentSettlement[];
  menuItems: MenuItem[];
  shelfLifeEntries?: ShelfLifeEntry[];
  posSalesMap?: Record<string, number>;
  lastSettledAt?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [settledAt, setSettledAt] = useState(nowLocalInput());
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Group shelf life entries by payment type
  const { consignmentStockMap, upfrontStockMap, historicalConsignmentNames } = useMemo(() => {
    const cMap: Record<string, number> = {};
    const uMap: Record<string, number> = {};
    const histNames = new Set<string>();

    shelfLifeEntries.forEach((e) => {
      const key = e.item.trim().toLowerCase();
      if (e.payment_type === "consignment") {
        cMap[key] = (cMap[key] || 0) + e.qty;
      } else if (e.payment_type === "upfront") {
        uMap[key] = (uMap[key] || 0) + e.qty;
      }
    });

    settlements.forEach((s) => {
      s.consignment_settlement_items?.forEach((it) => {
        histNames.add(it.name.trim().toLowerCase());
      });
    });

    return {
      consignmentStockMap: cMap,
      upfrontStockMap: uMap,
      historicalConsignmentNames: histNames,
    };
  }, [shelfLifeEntries, settlements]);

  function getItemType(name: string): "consignment" | "upfront" | "unknown" {
    const key = name.trim().toLowerCase();
    if (!key) return "unknown";
    if (consignmentStockMap[key] != null && consignmentStockMap[key] > 0) return "consignment";
    if (historicalConsignmentNames.has(key)) return "consignment";
    if (upfrontStockMap[key] != null && upfrontStockMap[key] > 0) return "upfront";
    return "unknown";
  }

  function getPosSold(name: string): number {
    return posSalesMap[name.trim().toLowerCase()] ?? 0;
  }

  function updateItem(idx: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function handleNameChange(idx: number, name: string) {
    const key = name.trim().toLowerCase();
    const match = menuItems.find((m) => m.name.toLowerCase() === key);
    const costVal = match?.cost != null ? String(match.cost) : items[idx].cost;

    // Prefer consignment stock from shelf-life, fallback to menu stock
    const consignmentQty = consignmentStockMap[key];
    const upfrontQty = upfrontStockMap[key];
    
    let remainingVal = items[idx].remaining;
    if (consignmentQty != null) {
      remainingVal = String(consignmentQty);
    } else if (upfrontQty != null) {
      remainingVal = String(upfrontQty);
    } else if (match?.stock != null) {
      remainingVal = String(match.stock);
    }

    updateItem(idx, {
      name,
      cost: costVal,
      remaining: remainingVal,
      soldOut: remainingVal === "0" ? true : items[idx].soldOut,
    });
  }

  function handleDeliveredChange(idx: number, deliveredVal: string) {
    const it = items[idx];
    const posSold = getPosSold(it.name);
    const delNum = parseInt(deliveredVal, 10);

    const patch: Partial<DraftItem> = { delivered: deliveredVal };
    if (!isNaN(delNum) && !it.soldOut) {
      patch.remaining = String(Math.max(0, delNum - posSold));
    }
    updateItem(idx, patch);
  }

  function handleAutoFillAll() {
    // Only auto-fill items that are verified Consignment (or active in consignment shelf life)
    // and explicitly skip items that are purely upfront stock
    const consignmentCandidates = menuItems.filter((m) => {
      const key = m.name.trim().toLowerCase();
      const isPurelyUpfront = upfrontStockMap[key] != null && !consignmentStockMap[key] && !historicalConsignmentNames.has(key);
      if (isPurelyUpfront) return false;

      const hasConsignmentShelfStock = consignmentStockMap[key] != null && consignmentStockMap[key] > 0;
      const isHistorical = historicalConsignmentNames.has(key);
      const posSold = getPosSold(m.name);

      return hasConsignmentShelfStock || isHistorical || (posSold > 0 && !isPurelyUpfront);
    });

    const autoRows: DraftItem[] = consignmentCandidates.map((m) => {
      const key = m.name.trim().toLowerCase();
      const posSold = getPosSold(m.name);
      const currentStock = consignmentStockMap[key] ?? m.stock ?? 0;
      const totalDelivered = currentStock + posSold;

      return {
        name: m.name,
        delivered: totalDelivered > 0 ? String(totalDelivered) : "",
        remaining: String(currentStock),
        cost: m.cost != null ? String(m.cost) : "",
        soldOut: currentStock === 0 && posSold > 0,
      };
    });

    if (autoRows.length > 0) {
      setItems(autoRows);
      setSavedMsg(`Auto-filled ${autoRows.length} consignment item${autoRows.length === 1 ? "" : "s"} (Upfront stock excluded).`);
      setTimeout(() => setSavedMsg(null), 3000);
    } else {
      setError("No active consignment items found. (Upfront items are excluded).");
      setTimeout(() => setError(null), 3000);
    }
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
      const itemType = getItemType(it.name);
      return {
        name: it.name.trim(),
        delivered,
        remaining,
        sold,
        cost,
        owed,
        soldOut: it.soldOut,
        itemType,
      };
    });

  const totalOwed = rows.reduce((s, r) => s + (r.owed ?? 0), 0);
  const anyMissingCost = rows.some((r) => r.cost == null);
  const anyUpfrontIncluded = rows.some((r) => r.itemType === "upfront");

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
        Log tonight&apos;s baki (remaining stock) for consignment supplier items only — auto-calculated using actual POS register sales
        {lastSettledAt
          ? ` since ${new Date(lastSettledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}.`
          : "."}
      </p>

      {/* Info notice explaining consignment vs upfront */}
      <div className="mb-4 rounded-xl border border-border bg-surface-alt/60 p-3 text-xs text-ink-muted flex items-start gap-2.5">
        <span className="text-base">💡</span>
        <div>
          <strong className="text-ink font-semibold">Consignment vs Upfront:</strong> This page is only for items where suppliers are paid after sales. Items bought <strong>Upfront</strong> (already paid on delivery) are excluded from auto-fill to prevent paying suppliers twice.
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div>
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
          <button
            type="button"
            onClick={handleAutoFillAll}
            className="rounded-xl border border-accent bg-accent-soft px-3.5 py-2 text-xs font-bold text-accent transition hover:bg-accent hover:text-white"
          >
            ⚡ Auto-Fill Consignment Items from POS Sales
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((it, idx) => {
            const key = it.name.trim().toLowerCase();
            const posSold = getPosSold(it.name);
            const itemType = getItemType(it.name);
            const upfrontUnits = upfrontStockMap[key];
            const consignmentUnits = consignmentStockMap[key];

            return (
              <div
                key={idx}
                className={`flex flex-col gap-2 rounded-xl border p-3.5 transition ${
                  itemType === "upfront"
                    ? "border-gold/60 bg-gold/5"
                    : "border-border bg-bg"
                }`}
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between">
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                        Item Name
                      </label>
                      <div className="flex items-center gap-1.5">
                        {it.name && posSold > 0 && (
                          <span className="mb-1 rounded-full bg-success-soft px-1.5 py-0.5 text-[10px] font-bold text-success">
                            POS Sold: {posSold}
                          </span>
                        )}
                        {itemType === "consignment" && consignmentUnits != null && (
                          <span className="mb-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent">
                            {consignmentUnits} on shelf
                          </span>
                        )}
                      </div>
                    </div>
                    <input
                      value={it.name}
                      onChange={(e) => handleNameChange(idx, e.target.value)}
                      list="consignment-menu-names"
                      placeholder="e.g. Roti Golok"
                      className="input"
                    />
                    <datalist id="consignment-menu-names">
                      {menuItems.map((m) => {
                        const mKey = m.name.trim().toLowerCase();
                        const isUpfront = upfrontStockMap[mKey] != null && !consignmentStockMap[mKey];
                        return (
                          <option
                            key={m.id}
                            value={m.name}
                            label={isUpfront ? `${m.name} (Upfront - Paid)` : `${m.name} (Consignment)`}
                          />
                        );
                      })}
                    </datalist>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      Delivered
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={it.delivered}
                      onChange={(e) => handleDeliveredChange(idx, e.target.value)}
                      placeholder="Delivered"
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      Remaining
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={it.soldOut ? "" : it.remaining}
                      disabled={it.soldOut}
                      onChange={(e) => updateItem(idx, { remaining: e.target.value })}
                      placeholder={it.soldOut ? "Sold out" : "Remaining"}
                      className="input disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      Cost/unit
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={it.cost}
                      onChange={(e) => updateItem(idx, { cost: e.target.value })}
                      placeholder="Cost/unit"
                      className="input"
                    />
                  </div>

                  <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
                    <button
                      type="button"
                      onClick={() => updateItem(idx, { soldOut: !it.soldOut, remaining: "" })}
                      className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold sm:flex-none ${
                        it.soldOut ? "bg-danger text-white" : "border border-border text-ink-muted"
                      }`}
                    >
                      Sold out
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="rounded-lg border border-border px-2 py-2 text-xs font-bold text-danger"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Warning if the user enters an item that is Upfront stock */}
                {itemType === "upfront" && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-gold/40 bg-surface-alt px-2.5 py-1.5 text-xs text-gold">
                    <span>⚠️</span>
                    <span>
                      <strong>Upfront Payment Stock:</strong> You have {upfrontUnits ?? 0} units logged under Upfront in Shelf Life (already paid). Only pay supplier if this was a new consignment delivery.
                    </span>
                  </div>
                )}
              </div>
            );
          })}
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
            {anyUpfrontIncluded && (
              <p className="mt-1 text-xs text-gold font-semibold">
                ⚠️ Warning: An Upfront item is in this settlement. Make sure you don&apos;t pay twice for stock already bought upfront.
              </p>
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

  const label = new Date(settlement.settled_at).toLocaleString("en-US", {
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
