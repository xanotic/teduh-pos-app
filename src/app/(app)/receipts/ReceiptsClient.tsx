"use client";

import { useMemo, useState, useTransition } from "react";
import type { Vendor } from "@/lib/types";
import { QrModal } from "@/components/QrModal";
import { compressImage } from "@/lib/compressImage";
import { deleteReceipt, uploadReceipt } from "./actions";

interface ReceiptRow {
  id: string;
  date: string;
  note: string | null;
  vendorId: string | null;
  imagePath: string;
  url: string | null;
}

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ReceiptsClient({ receipts, vendors }: { receipts: ReceiptRow[]; vendors: Vendor[] }) {
  const [date, setDate] = useState(todayLocal());
  const [note, setNote] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState<ReceiptRow | null>(null);

  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setCompressing(true);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.set("file", compressed);
      fd.set("date", date);
      fd.set("note", note);
      fd.set("vendorId", vendorId);
      setCompressing(false);
      startTransition(async () => {
        try {
          await uploadReceipt(fd);
          setNote("");
          setVendorId("");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Upload failed.");
        }
      });
    } catch (err) {
      setCompressing(false);
      setError(err instanceof Error ? err.message : "Could not process image.");
    }
  }

  const byDate = receipts.reduce<Record<string, ReceiptRow[]>>((acc, r) => {
    (acc[r.date] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-bold text-ink">Receipts</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Snap a photo of each day&apos;s receipts as you get them — kept private to this account, resized
        automatically so it doesn&apos;t eat storage.
      </p>

      <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Vendor (optional)
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
              Note (optional)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. delivery slip"
              className="input"
            />
          </div>
        </div>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
          id="receipt-file"
          disabled={compressing || pending}
        />
        <label
          htmlFor="receipt-file"
          className={`block w-full cursor-pointer rounded-xl bg-accent py-3 text-center text-sm font-bold text-white ${
            compressing || pending ? "opacity-50" : ""
          }`}
        >
          {compressing ? "Processing photo…" : pending ? "Uploading…" : "📷 Add Receipt Photo"}
        </label>
        {error && <p className="mt-2 text-xs font-semibold text-danger">{error}</p>}
      </div>

      {Object.keys(byDate)
        .sort((a, b) => (a < b ? 1 : -1))
        .map((d) => (
          <div key={d} className="mb-5">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
              {new Date(d + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {byDate[d].map((r) => {
                const vendorName = r.vendorId ? vendorById.get(r.vendorId)?.name : null;
                return (
                <div key={r.id} className="relative rounded-xl border border-border bg-surface p-1.5">
                  {r.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.url}
                      alt={r.note ?? "Receipt"}
                      onClick={() => setEnlarged(r)}
                      className="aspect-square w-full cursor-zoom-in rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-surface-alt text-[10px] text-ink-muted">
                      Unavailable
                    </div>
                  )}
                  {vendorName && (
                    <p className="mt-1 truncate text-[10px] font-bold text-accent">{vendorName}</p>
                  )}
                  {r.note && <p className="truncate text-[10px] text-ink-muted">{r.note}</p>}
                  <button
                    onClick={() =>
                      confirmId === r.id
                        ? startTransition(async () => {
                            await deleteReceipt(r.id, r.imagePath);
                            setConfirmId(null);
                          })
                        : setConfirmId(r.id)
                    }
                    className={`absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow-sm ${
                      confirmId === r.id ? "bg-danger text-white" : "bg-surface text-danger"
                    }`}
                  >
                    {confirmId === r.id ? "✔" : "✕"}
                  </button>
                </div>
                );
              })}
            </div>
          </div>
        ))}

      {receipts.length === 0 && <p className="text-sm text-ink-muted">No receipts uploaded yet.</p>}

      {enlarged && enlarged.url && (
        <QrModal
          url={enlarged.url}
          label={enlarged.note ?? new Date(enlarged.date + "T00:00:00").toLocaleDateString()}
          onClose={() => setEnlarged(null)}
        />
      )}
    </div>
  );
}
