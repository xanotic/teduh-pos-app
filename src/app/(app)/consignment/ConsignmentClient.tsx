"use client";

import { useMemo, useState, useTransition } from "react";
import type { ConsignmentSettlement, Vendor } from "@/lib/types";
import { fmt } from "@/lib/format";
import { QrModal } from "@/components/QrModal";
import { createSettlement, deleteSettlement, markSettlementPaid } from "./actions";

type ItemType = "consignment" | "upfront" | "unknown";

interface SoldItem {
  name: string;
  qty: number;
  cost: number;
  hasMissingCost: boolean;
  type: ItemType;
  vendorId: string | null;
}

export function ConsignmentClient({
  settlements,
  vendors = [],
  soldItems,
  periodLabel,
}: {
  settlements: ConsignmentSettlement[];
  vendors?: Vendor[];
  soldItems: SoldItem[];
  periodLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [costOverrides, setCostOverrides] = useState<Record<string, string>>({});
  const [enlargedQr, setEnlargedQr] = useState<{ url: string; label: string } | null>(null);

  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  // Upfront items are already paid on delivery — this page is consignment
  // payout only, so they're left out of the list entirely, not just the
  // total. Reclassify an item from Shelf Life or Menu if it ends up here
  // by mistake.
  const payoutCandidates = soldItems.filter((r) => r.type !== "upfront");

  const rows = payoutCandidates
    .filter((r) => !excluded.has(r.name))
    .map((r) => {
      const override = costOverrides[r.name];
      const effectiveCost = r.hasMissingCost ? (override ? parseFloat(override) || 0 : 0) : r.cost;
      return { ...r, effectiveCost };
    });

  const totalOwed = rows.reduce((s, r) => s + r.effectiveCost, 0);
  const anyMissingCost = rows.some((r) => r.hasMissingCost && !costOverrides[r.name]);

  const vendorGroups = useMemo(() => {
    const groups = new Map<string, { vendor: Vendor | null; rows: typeof rows }>();
    for (const r of rows) {
      const key = r.vendorId ?? "none";
      if (!groups.has(key)) groups.set(key, { vendor: r.vendorId ? vendorById.get(r.vendorId) ?? null : null, rows: [] });
      groups.get(key)!.rows.push(r);
    }
    return Array.from(groups.values())
      .map((g) => ({ ...g, subtotal: g.rows.reduce((s, r) => s + r.effectiveCost, 0) }))
      .sort((a, b) => (a.vendor ? 0 : 1) - (b.vendor ? 0 : 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, vendorById]);

  const alreadySettledThisPeriod = settlements.some((s) => s.period_label === periodLabel);

  function toggleExclude(name: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleSave() {
    if (!rows.length) return;
    setError(null);
    startTransition(async () => {
      try {
        await createSettlement({
          settledAt: new Date().toISOString(),
          periodLabel,
          items: rows.map((r) => ({
            name: r.name,
            deliveredQty: r.qty,
            remainingQty: 0,
            cost: r.qty > 0 ? r.effectiveCost / r.qty : 0,
          })),
        });
        setSavedMsg("Settlement saved.");
        setTimeout(() => setSavedMsg(null), 2500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save settlement.");
      }
    });
  }

  return (
    <>
      <h1 className="text-xl font-bold text-ink">Consignment Payout</h1>
      <p className="mb-5 text-sm text-ink-muted">
        What actually sold for <strong className="text-ink">{periodLabel}</strong>, straight from POS register
        sales — pick a different date/range above to change this. Items bought <strong>Upfront</strong> (already
        paid on delivery) are excluded automatically.
      </p>

      {payoutCandidates.length === 0 ? (
        <div className="mb-6 rounded-2xl border border-border bg-surface p-6 text-center text-sm text-ink-muted shadow-sm">
          No consignment sales in this period.
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex flex-col gap-2">
            {payoutCandidates.map((r) => {
              const isExcluded = excluded.has(r.name);
              return (
                <div
                  key={r.name}
                  className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 ${
                    isExcluded ? "border-border bg-surface-alt opacity-60" : "border-border bg-bg"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleExclude(r.name)}
                    className={`rounded-md px-2 py-1 text-xs font-bold ${
                      isExcluded ? "bg-surface text-ink-muted" : "bg-success-soft text-success"
                    }`}
                    title={isExcluded ? "Include in payout" : "Exclude from payout"}
                  >
                    {isExcluded ? "Excluded" : "✓ Included"}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                    {r.name} <span className="font-normal text-ink-muted">· sold {r.qty}</span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      r.type === "unknown" ? "bg-surface-alt text-gold" : "bg-accent-soft text-accent"
                    }`}
                    title="Set on the Menu tab"
                  >
                    {r.type === "unknown" ? "Not set — fix on Menu" : r.type === "consignment" ? "Consignment" : "Upfront"}
                  </span>
                  {!r.vendorId && !isExcluded && (
                    <span className="rounded-full bg-surface-alt px-2 py-0.5 text-[11px] font-bold text-ink-muted">
                      No vendor — set on Menu
                    </span>
                  )}
                  {r.hasMissingCost ? (
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={costOverrides[r.name] ?? ""}
                      onChange={(e) => setCostOverrides((prev) => ({ ...prev, [r.name]: e.target.value }))}
                      placeholder="Cost owed"
                      className="input w-28"
                      disabled={isExcluded}
                    />
                  ) : (
                    <span className="font-bold text-ink">{fmt(r.cost)}</span>
                  )}
                </div>
              );
            })}
          </div>
          {error && <p className="mt-2 text-xs font-semibold text-danger">{error}</p>}

          {rows.length > 0 && (
            <div className="mt-4 rounded-xl border border-border bg-bg p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">To pay, by vendor</span>
                <span className="text-lg font-extrabold text-accent">{fmt(totalOwed)}</span>
              </div>

              <div className="flex flex-col gap-3">
                {vendorGroups.map((g) => {
                  const groupKey = g.vendor?.id ?? "none";
                  return (
                    <div key={groupKey} className="rounded-lg border border-border bg-surface p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-ink">{g.vendor ? g.vendor.name : "No vendor assigned"}</span>
                        <span className="font-extrabold text-ink">{fmt(g.subtotal)}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {g.rows.map((r) => (
                          <div key={r.name} className="flex items-center justify-between gap-2 text-xs text-ink-muted">
                            <span className="min-w-0 truncate">
                              {r.name} · sold {r.qty}
                            </span>
                            <span className="flex-none font-semibold text-ink">{fmt(r.effectiveCost)}</span>
                          </div>
                        ))}
                      </div>
                      {g.vendor?.qr_url && (
                        <button
                          type="button"
                          onClick={() => setEnlargedQr({ url: g.vendor!.qr_url!, label: `${g.vendor!.name} QR pay code` })}
                          className="mt-2.5 flex w-full items-center gap-2.5 rounded-lg border border-accent/40 bg-accent-soft p-2 text-left"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={g.vendor.qr_url}
                            alt={`${g.vendor.name} QR pay code`}
                            className="h-16 w-16 cursor-zoom-in rounded-md object-cover"
                          />
                          <span className="text-xs font-bold text-accent">
                            📱 Tap to enlarge — scan to pay {g.vendor.name} {fmt(g.subtotal)}
                          </span>
                        </button>
                      )}
                      {g.vendor && !g.vendor.qr_url && (
                        <p className="mt-2 text-[11px] text-ink-muted">
                          No QR pay code set for {g.vendor.name} yet — add one in Shelf Life → Vendors.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {anyMissingCost && (
                <p className="mt-3 text-xs text-gold">
                  Some items have no cost set — enter a cost owed above or they won&apos;t be included in the total.
                </p>
              )}
            </div>
          )}

          {alreadySettledThisPeriod && (
            <p className="mt-3 text-xs font-semibold text-gold">
              ⚠️ You already have a settlement saved for {periodLabel} — saving again will add a duplicate.
            </p>
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
      )}

      <h2 className="mb-3 text-sm font-bold text-ink">Past Settlements</h2>
      <div className="flex flex-col gap-3">
        {settlements.map((s) => (
          <SettlementCard key={s.id} settlement={s} />
        ))}
        {settlements.length === 0 && <p className="text-sm text-ink-muted">No settlements logged yet.</p>}
      </div>

      {enlargedQr && <QrModal url={enlargedQr.url} label={enlargedQr.label} onClose={() => setEnlargedQr(null)} />}
    </>
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

  const dateLabel = new Date(settlement.settled_at).toLocaleString("en-US", {
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
          <div className="text-sm font-bold text-ink">{settlement.period_label ?? dateLabel}</div>
          <div className="text-xs text-ink-muted">
            {settlement.period_label ? `Recorded ${dateLabel} · ` : ""}
            {rows.length} item{rows.length === 1 ? "" : "s"}
          </div>
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
                  <span className="ml-2 text-xs text-ink-muted">sold {r.sold}</span>
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
