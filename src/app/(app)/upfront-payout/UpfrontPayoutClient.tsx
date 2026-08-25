"use client";

import { useMemo, useState, useTransition } from "react";
import type { UpfrontPayout, Vendor } from "@/lib/types";
import { fmt } from "@/lib/format";
import { QrModal } from "@/components/QrModal";
import { createUpfrontPayout, deleteUpfrontPayout, markUpfrontPayoutPaid } from "./actions";

export function UpfrontPayoutClient({ payouts, vendors }: { payouts: UpfrontPayout[]; vendors: Vendor[] }) {
  const [vendorId, setVendorId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [enlargedQr, setEnlargedQr] = useState<{ url: string; label: string } | null>(null);

  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);
  const selectedVendor = vendorId ? vendorById.get(vendorId) : null;

  const owing = payouts.filter((p) => !p.paid).reduce((s, p) => s + Number(p.amount), 0);

  function handleSave() {
    const amt = parseFloat(amount);
    if (!(amt > 0)) {
      setError("Enter an amount greater than 0.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createUpfrontPayout({ vendorId: vendorId || null, amount: amt, note });
        setAmount("");
        setNote("");
        setSavedMsg("Payout logged.");
        setTimeout(() => setSavedMsg(null), 2500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save payout.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-bold text-ink">Upfront Payout</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Pay an upfront vendor one lump sum for a delivery — no item breakdown needed, that&apos;s what
        Consignment Payout is for.
      </p>

      {owing > 0 && (
        <div className="mb-5 rounded-2xl border border-danger bg-danger-soft p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-danger">Marked unpaid so far</div>
          <div className="text-lg font-extrabold text-danger">{fmt(owing)}</div>
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Vendor
            </label>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="input">
              <option value="">— None —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
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
              placeholder="0.00"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Note (optional)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. this week's delivery"
              className="input"
            />
          </div>
        </div>

        {selectedVendor?.qr_url && (
          <button
            type="button"
            onClick={() => setEnlargedQr({ url: selectedVendor.qr_url!, label: `${selectedVendor.name} QR pay code` })}
            className="mb-3 flex w-full items-center gap-2.5 rounded-lg border border-accent/40 bg-accent-soft p-2 text-left"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedVendor.qr_url}
              alt={`${selectedVendor.name} QR pay code`}
              className="h-16 w-16 cursor-zoom-in rounded-md object-cover"
            />
            <span className="text-xs font-bold text-accent">
              📱 Tap to enlarge — scan to pay {selectedVendor.name}
              {amount && parseFloat(amount) > 0 ? ` ${fmt(parseFloat(amount))}` : ""}
            </span>
          </button>
        )}
        {selectedVendor && !selectedVendor.qr_url && (
          <p className="mb-3 text-[11px] text-ink-muted">
            No QR pay code set for {selectedVendor.name} yet — add one in Shelf Life → Vendors.
          </p>
        )}

        <button
          disabled={pending}
          onClick={handleSave}
          className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Log Payout"}
        </button>
        {error && <p className="mt-2 text-xs font-semibold text-danger">{error}</p>}
        {savedMsg && <p className="mt-2 text-xs font-semibold text-success">{savedMsg}</p>}
      </div>

      <h2 className="mb-3 text-sm font-bold text-ink">Payout History</h2>
      <div className="flex flex-col gap-2">
        {payouts.map((p) => (
          <PayoutRow key={p.id} payout={p} vendorName={p.vendor_id ? vendorById.get(p.vendor_id)?.name ?? null : null} />
        ))}
        {payouts.length === 0 && <p className="text-sm text-ink-muted">No payouts logged yet.</p>}
      </div>

      {enlargedQr && <QrModal url={enlargedQr.url} label={enlargedQr.label} onClose={() => setEnlargedQr(null)} />}
    </div>
  );
}

function PayoutRow({ payout, vendorName }: { payout: UpfrontPayout; vendorName: string | null }) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dateLabel = new Date(payout.created_at).toLocaleString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">{vendorName ?? "No vendor"}</div>
        <div className="text-xs text-ink-muted">
          {dateLabel}
          {payout.note ? ` · ${payout.note}` : ""}
        </div>
      </div>
      <span className="font-extrabold text-ink">{fmt(Number(payout.amount))}</span>
      <button
        disabled={pending}
        onClick={() => startTransition(() => markUpfrontPayoutPaid(payout.id, !payout.paid))}
        className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
          payout.paid ? "border border-border text-ink-muted" : "bg-success text-white"
        }`}
      >
        {payout.paid ? "Paid" : "Mark as paid"}
      </button>
      <button
        disabled={pending}
        onClick={() =>
          confirmDelete
            ? startTransition(async () => {
                await deleteUpfrontPayout(payout.id);
                setConfirmDelete(false);
              })
            : setConfirmDelete(true)
        }
        className={`rounded-md px-2 py-1 text-xs font-bold ${
          confirmDelete ? "bg-danger text-white" : "bg-surface-alt text-danger"
        }`}
      >
        {confirmDelete ? "✔" : "✕"}
      </button>
    </div>
  );
}
