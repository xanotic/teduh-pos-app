"use client";

import { useRef, useState, useTransition } from "react";
import type { Vendor } from "@/lib/types";
import { addVendor, deleteVendor, uploadVendorQr } from "./actions";

export function VendorManager({ vendors }: { vendors: Vendor[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addVendor(name.trim());
        setName("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add vendor.");
      }
    });
  }

  return (
    <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <h2 className="text-sm font-bold text-ink">🏪 Vendors</h2>
          <p className="text-xs text-ink-muted">
            {vendors.length === 0
              ? "Add your suppliers and their QR pay code for fast daily payouts."
              : `${vendors.length} vendor${vendors.length === 1 ? "" : "s"} set up.`}
          </p>
        </div>
        <span className="text-ink-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-4 border-t border-border pt-4">
          <form onSubmit={handleAdd} className="mb-3 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vendor name e.g. Kak Mira's Kitchen"
              className="input flex-1"
            />
            <button
              disabled={pending}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              + Add
            </button>
          </form>
          {error && <p className="mb-3 text-xs font-semibold text-danger">{error}</p>}

          <div className="flex flex-col gap-2">
            {vendors.map((v) => (
              <VendorRow
                key={v.id}
                vendor={v}
                confirmDelete={confirmDeleteId === v.id}
                onAskDelete={() => setConfirmDeleteId(v.id)}
                onCancelDelete={() => setConfirmDeleteId(null)}
              />
            ))}
            {vendors.length === 0 && <p className="text-sm text-ink-muted">No vendors yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function VendorRow({
  vendor,
  confirmDelete,
  onAskDelete,
  onCancelDelete,
}: {
  vendor: Vendor;
  confirmDelete: boolean;
  onAskDelete: () => void;
  onCancelDelete: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      try {
        await uploadVendorQr(vendor.id, fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-bg px-3 py-2.5">
      {vendor.qr_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={vendor.qr_url} alt={`${vendor.name} QR pay code`} className="h-12 w-12 rounded-md object-cover" />
      ) : (
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-surface-alt text-[9px] text-ink-muted">
          No QR
        </div>
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{vendor.name}</span>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" id={`qr-${vendor.id}`} />
      <label
        htmlFor={`qr-${vendor.id}`}
        className="cursor-pointer rounded-md bg-surface-alt px-2.5 py-1 text-xs font-bold text-ink-muted"
      >
        {pending ? "Uploading…" : vendor.qr_url ? "Replace QR" : "Upload QR"}
      </label>
      <button
        onClick={() => (confirmDelete ? startTransition(() => deleteVendor(vendor.id)) : onAskDelete())}
        onBlur={onCancelDelete}
        className={`rounded-md px-2 py-1 text-xs font-bold ${
          confirmDelete ? "bg-danger text-white" : "bg-surface-alt text-danger"
        }`}
      >
        {confirmDelete ? "✔" : "✕"}
      </button>
      {error && <p className="basis-full text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
