"use client";

import { useMemo, useState } from "react";
import type { ConsignmentSettlement, MenuItem, Vendor } from "@/lib/types";
import { fmt } from "@/lib/format";
import { QrModal } from "@/components/QrModal";
import { VendorManager } from "./VendorManager";

interface ReceiptRow {
  id: string;
  date: string;
  note: string | null;
  vendorId: string | null;
  url: string | null;
}

export function VendorClient({
  vendors,
  items,
  itemVendorMap,
  soldTodayMap,
  settlements,
  receipts,
}: {
  vendors: Vendor[];
  items: MenuItem[];
  itemVendorMap: Record<string, string>;
  soldTodayMap: Record<string, number>;
  settlements: ConsignmentSettlement[];
  receipts: ReceiptRow[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [enlargedQr, setEnlargedQr] = useState<{ url: string; label: string } | null>(null);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-bold text-ink">Vendors</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Add/remove vendors and their QR pay code, and see everything tied to each one — items
        supplied, current stock, today&apos;s sales, payout history, and receipts.
      </p>

      <VendorManager vendors={vendors} />

      <div className="flex flex-col gap-3">
        {vendors.map((v) => (
          <VendorCard
            key={v.id}
            vendor={v}
            open={openId === v.id}
            onToggle={() => setOpenId((id) => (id === v.id ? null : v.id))}
            items={items.filter((it) => it.vendor_id === v.id)}
            soldTodayMap={soldTodayMap}
            settlements={settlements}
            itemVendorMap={itemVendorMap}
            receipts={receipts.filter((r) => r.vendorId === v.id)}
            onEnlargeQr={() => v.qr_url && setEnlargedQr({ url: v.qr_url, label: `${v.name} QR pay code` })}
          />
        ))}
        {vendors.length === 0 && (
          <p className="text-sm text-ink-muted">No vendors yet — add one above.</p>
        )}
      </div>

      {enlargedQr && <QrModal url={enlargedQr.url} label={enlargedQr.label} onClose={() => setEnlargedQr(null)} />}
    </div>
  );
}

function VendorCard({
  vendor,
  open,
  onToggle,
  items,
  soldTodayMap,
  settlements,
  itemVendorMap,
  receipts,
  onEnlargeQr,
}: {
  vendor: Vendor;
  open: boolean;
  onToggle: () => void;
  items: MenuItem[];
  soldTodayMap: Record<string, number>;
  settlements: ConsignmentSettlement[];
  itemVendorMap: Record<string, string>;
  receipts: ReceiptRow[];
  onEnlargeQr: () => void;
}) {
  const soldToday = items.reduce((s, it) => s + (soldTodayMap[it.name.trim().toLowerCase()] ?? 0), 0);

  const payoutHistory = useMemo(() => {
    return settlements
      .map((s) => {
        const vendorItems = s.consignment_settlement_items.filter(
          (it) => itemVendorMap[it.name.trim().toLowerCase()] === vendor.id
        );
        const owed = vendorItems.reduce((sum, it) => {
          const sold = Math.max(it.delivered_qty - it.remaining_qty, 0);
          return sum + (it.cost != null ? it.cost * sold : 0);
        }, 0);
        return { settlement: s, vendorItems, owed };
      })
      .filter((g) => g.vendorItems.length > 0);
  }, [settlements, itemVendorMap, vendor.id]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-3">
          {vendor.qr_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vendor.qr_url}
              alt={`${vendor.name} QR`}
              onClick={(e) => {
                e.stopPropagation();
                onEnlargeQr();
              }}
              className="h-10 w-10 cursor-zoom-in rounded-md object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-surface-alt text-[8px] text-ink-muted">
              No QR
            </div>
          )}
          <div>
            <div className="text-sm font-bold text-ink">{vendor.name}</div>
            <div className="text-xs text-ink-muted">
              {items.length} item{items.length === 1 ? "" : "s"} · sold {soldToday} today
            </div>
          </div>
        </div>
        <span className="text-ink-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Items supplied</h3>
            {items.length === 0 ? (
              <p className="text-xs text-ink-muted">No items assigned to this vendor yet — set it on the Menu tab.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {items.map((it) => (
                  <div
                    key={it.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-bg px-3 py-1.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">{it.name}</span>
                    <span className="text-xs text-ink-muted">{fmt(it.price)}</span>
                    {it.payment_type && (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
                        {it.payment_type === "consignment" ? "Consignment" : "Upfront"}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        it.stock == null
                          ? "bg-surface-alt text-ink-muted"
                          : it.stock === 0
                            ? "bg-danger-soft text-danger"
                            : "bg-success-soft text-success"
                      }`}
                    >
                      {it.stock == null ? "Not tracked" : `${it.stock} left`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Payout history</h3>
            {payoutHistory.length === 0 ? (
              <p className="text-xs text-ink-muted">No consignment settlements for this vendor yet.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {payoutHistory.map(({ settlement, owed }) => (
                  <div key={settlement.id} className="flex items-center justify-between rounded-lg bg-bg px-3 py-1.5 text-sm">
                    <span className="text-ink-muted">{settlement.period_label ?? new Date(settlement.settled_at).toLocaleDateString()}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink">{fmt(owed)}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          settlement.paid ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
                        }`}
                      >
                        {settlement.paid ? "Paid" : "Owing"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Receipts</h3>
            {receipts.length === 0 ? (
              <p className="text-xs text-ink-muted">No receipts tagged to this vendor yet.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {receipts.map((r) => (
                  <a
                    key={r.id}
                    href={r.url ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="block aspect-square overflow-hidden rounded-lg bg-surface-alt"
                    title={r.note ?? r.date}
                  >
                    {r.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.url} alt={r.note ?? "Receipt"} className="h-full w-full object-cover" />
                    ) : null}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
