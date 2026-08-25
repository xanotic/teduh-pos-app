"use client";

import { useMemo, useState, useTransition } from "react";
import type { Vendor } from "@/lib/types";
import { QrModal } from "@/components/QrModal";
import { compressImage } from "@/lib/compressImage";
import { deleteReceipt, updateReceipt, uploadReceipt } from "./actions";

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
              {byDate[d].map((r) => (
                <ReceiptCard
                  key={r.id}
                  receipt={r}
                  vendors={vendors}
                  vendorName={r.vendorId ? vendorById.get(r.vendorId)?.name ?? null : null}
                  onEnlarge={() => setEnlarged(r)}
                />
              ))}
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

function ReceiptCard({
  receipt,
  vendors,
  vendorName,
  onEnlarge,
}: {
  receipt: ReceiptRow;
  vendors: Vendor[];
  vendorName: string | null;
  onEnlarge: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState(receipt.date);
  const [editVendorId, setEditVendorId] = useState(receipt.vendorId ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateReceipt(receipt.id, { date: editDate, vendorId: editVendorId || null });
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed — try again.");
      }
    });
  }

  return (
    <div className="relative rounded-xl border border-border bg-surface p-1.5">
      {receipt.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={receipt.url}
          alt={receipt.note ?? "Receipt"}
          onClick={onEnlarge}
          className="aspect-square w-full cursor-zoom-in rounded-lg object-cover"
        />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-surface-alt text-[10px] text-ink-muted">
          Unavailable
        </div>
      )}

      {editing ? (
        <div className="mt-1 flex flex-col gap-1">
          <input
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            className="w-full rounded-md border border-border bg-bg px-1 py-0.5 text-[10px]"
          />
          <select
            value={editVendorId}
            onChange={(e) => setEditVendorId(e.target.value)}
            className="w-full rounded-md border border-border bg-bg px-1 py-0.5 text-[10px]"
          >
            <option value="">— None —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            <button
              disabled={pending}
              onClick={handleSave}
              className="flex-1 rounded-md bg-accent px-1 py-0.5 text-[10px] font-bold text-white disabled:opacity-50"
            >
              {pending ? "…" : "Save"}
            </button>
            <button
              disabled={pending}
              onClick={() => setEditing(false)}
              className="flex-1 rounded-md border border-border px-1 py-0.5 text-[10px] font-bold text-ink-muted"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-[9px] font-semibold text-danger">{error}</p>}
        </div>
      ) : (
        <>
          {vendorName && <p className="mt-1 truncate text-[10px] font-bold text-accent">{vendorName}</p>}
          {receipt.note && <p className="truncate text-[10px] text-ink-muted">{receipt.note}</p>}
          <button
            onClick={() => setEditing(true)}
            className="absolute right-8 top-2 rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-bold text-ink-muted shadow-sm"
          >
            ✎
          </button>
        </>
      )}

      <button
        onClick={() =>
          confirmDelete
            ? startTransition(async () => {
                await deleteReceipt(receipt.id, receipt.imagePath);
                setConfirmDelete(false);
              })
            : setConfirmDelete(true)
        }
        className={`absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow-sm ${
          confirmDelete ? "bg-danger text-white" : "bg-surface text-danger"
        }`}
      >
        {confirmDelete ? "✔" : "✕"}
      </button>
    </div>
  );
}
