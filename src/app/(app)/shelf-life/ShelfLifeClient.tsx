"use client";

import { useMemo, useState, useTransition } from "react";
import type { MenuItem, PaymentType, ShelfLifeEntry, Vendor } from "@/lib/types";
import { fmt } from "@/lib/format";
import { addShelfLifeEntry, deleteShelfLifeEntry, updateShelfLifeEntry } from "./actions";
import { VendorManager } from "./VendorManager";

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

export function ShelfLifeClient({
  entries,
  menuItems,
  vendors,
}: {
  entries: ShelfLifeEntry[];
  menuItems: MenuItem[];
  vendors: Vendor[];
}) {
  const [tab, setTab] = useState<PaymentType>("consignment");
  const [pending, startTransition] = useTransition();
  const [item, setItem] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [costTouched, setCostTouched] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [vendorTouched, setVendorTouched] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [expiryFilter, setExpiryFilter] = useState<"all" | "expired" | "not_expired">("all");

  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  const filtered = entries.filter(
    (e) => e.payment_type === tab && (vendorFilter === "all" || (e.vendor_id ?? "none") === vendorFilter)
  );
  const sorted = [...filtered].sort((a, b) => daysLeft(a.expires_at) - daysLeft(b.expires_at));
  const expiredEntries = sorted.filter((e) => status(daysLeft(e.expires_at)) === "expired");
  const activeEntries = sorted.filter((e) => status(daysLeft(e.expires_at)) !== "expired");

  const lostAlready = sorted
    .filter((e) => status(daysLeft(e.expires_at)) === "expired")
    .reduce((s, e) => s + (e.cost ?? 0) * e.qty, 0);
  const atRisk = sorted
    .filter((e) => status(daysLeft(e.expires_at)) === "soon")
    .reduce((s, e) => s + (e.cost ?? 0) * e.qty, 0);

  function handleItemChange(v: string) {
    setItem(v);
    const match = menuItems.find((m) => m.name.toLowerCase() === v.trim().toLowerCase());
    if (!costTouched && match?.cost != null) setCost(String(match.cost));
    if (!vendorTouched) setVendorId(match?.vendor_id ?? "");
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
        vendorId: vendorId || null,
      });
      setItem("");
      setDate("");
      setNotes("");
      setQty("1");
      setCost("");
      setCostTouched(false);
      setVendorId("");
      setVendorTouched(false);
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

      <VendorManager vendors={vendors} />

      {vendors.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Vendor:</span>
          <button
            onClick={() => setVendorFilter("all")}
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              vendorFilter === "all" ? "bg-accent text-white" : "bg-surface-alt text-ink-muted"
            }`}
          >
            All
          </button>
          {vendors.map((v) => (
            <button
              key={v.id}
              onClick={() => setVendorFilter(v.id)}
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                vendorFilter === v.id ? "bg-accent text-white" : "bg-surface-alt text-ink-muted"
              }`}
            >
              {v.name}
            </button>
          ))}
          <button
            onClick={() => setVendorFilter("none")}
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              vendorFilter === "none" ? "bg-accent text-white" : "bg-surface-alt text-ink-muted"
            }`}
          >
            No vendor
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Show:</span>
        <button
          onClick={() => setExpiryFilter("all")}
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            expiryFilter === "all" ? "bg-accent text-white" : "bg-surface-alt text-ink-muted"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setExpiryFilter("not_expired")}
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            expiryFilter === "not_expired" ? "bg-accent text-white" : "bg-surface-alt text-ink-muted"
          }`}
        >
          Not expired
        </button>
        <button
          onClick={() => setExpiryFilter("expired")}
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            expiryFilter === "expired" ? "bg-accent text-white" : "bg-surface-alt text-ink-muted"
          }`}
        >
          Expired
        </button>
      </div>

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
        className="mb-6 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:grid-cols-7 sm:items-end"
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
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Vendor</label>
          <select
            value={vendorId}
            onChange={(e) => {
              setVendorId(e.target.value);
              setVendorTouched(true);
            }}
            className="input"
          >
            <option value="">— None —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <button
          disabled={pending}
          className="col-span-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-7"
        >
          Add to {TABS.find((t) => t.key === tab)?.label}
        </button>
      </form>

      {expiryFilter !== "not_expired" && expiredEntries.length > 0 && (
        <div className="mb-2">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-danger">
            Expired ({expiredEntries.length})
          </h2>
          <div className="flex flex-col gap-2">
            {expiredEntries.map((e) =>
              renderRow(e, {
                editingId,
                setEditingId,
                confirmId,
                setConfirmId,
                startTransition,
                vendorById,
                menuItems,
                vendors,
              })
            )}
          </div>
        </div>
      )}

      {expiryFilter !== "expired" && (
        <div className="mb-2 mt-4">
          {expiryFilter === "all" && expiredEntries.length > 0 && (
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
              Not expired ({activeEntries.length})
            </h2>
          )}
          <div className="flex flex-col gap-2">
            {activeEntries.map((e) =>
              renderRow(e, {
                editingId,
                setEditingId,
                confirmId,
                setConfirmId,
                startTransition,
                vendorById,
                menuItems,
                vendors,
              })
            )}
            {activeEntries.length === 0 && (
              <p className="text-sm text-ink-muted">
                No {expiryFilter === "not_expired" ? "not-expired " : ""}
                {TABS.find((t) => t.key === tab)?.label.toLowerCase()} entries.
              </p>
            )}
          </div>
        </div>
      )}

      {expiryFilter === "expired" && expiredEntries.length === 0 && (
        <p className="text-sm text-ink-muted">
          No expired {TABS.find((t) => t.key === tab)?.label.toLowerCase()} entries.
        </p>
      )}
    </div>
  );
}

function renderRow(
  e: ShelfLifeEntry,
  {
    editingId,
    setEditingId,
    confirmId,
    setConfirmId,
    startTransition,
    vendorById,
    menuItems,
    vendors,
  }: {
    editingId: string | null;
    setEditingId: (id: string | null) => void;
    confirmId: string | null;
    setConfirmId: (id: string | null) => void;
    startTransition: (fn: () => Promise<void>) => void;
    vendorById: Map<string, Vendor>;
    menuItems: MenuItem[];
    vendors: Vendor[];
  }
) {
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

  if (editingId === e.id) {
    return (
      <EditRow
        key={e.id}
        entry={e}
        menuItems={menuItems}
        vendors={vendors}
        onCancel={() => setEditingId(null)}
        onSaved={() => setEditingId(null)}
      />
    );
  }

  const vendorName = e.vendor_id ? vendorById.get(e.vendor_id)?.name : null;

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
      {vendorName && (
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
          {vendorName}
        </span>
      )}
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
        onClick={() => setEditingId(e.id)}
        className="rounded-md bg-surface-alt px-2 py-1 text-xs font-bold text-ink-muted"
      >
        Edit
      </button>
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
}

function EditRow({
  entry,
  menuItems,
  vendors,
  onCancel,
  onSaved,
}: {
  entry: ShelfLifeEntry;
  menuItems: MenuItem[];
  vendors: Vendor[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [item, setItem] = useState(entry.item);
  const [date, setDate] = useState(entry.expires_at);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [qty, setQty] = useState(String(entry.qty));
  const [initialQty, setInitialQty] = useState(String(entry.initial_qty ?? entry.qty));
  const [cost, setCost] = useState(entry.cost != null ? String(entry.cost) : "");
  const [paymentType, setPaymentType] = useState<PaymentType>(entry.payment_type);
  const [vendorId, setVendorId] = useState(entry.vendor_id ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!item.trim() || !date) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateShelfLifeEntry(entry.id, {
          item: item.trim(),
          expiresAt: date,
          notes: notes.trim(),
          qty: parseInt(qty, 10) || 1,
          initialQty: parseInt(initialQty, 10) || undefined,
          cost: cost === "" ? null : parseFloat(cost) || 0,
          paymentType,
          vendorId: vendorId || null,
        });
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed — try again.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-accent bg-surface p-3">
      <div className="mb-3">
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Payment type
        </label>
        <div className="flex gap-1 rounded-xl bg-surface-alt p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setPaymentType(t.key)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold ${
                paymentType === t.key ? "bg-accent text-white" : "text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <div className="col-span-2">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Item</label>
          <input value={item} onChange={(e) => setItem(e.target.value)} list="menu-names" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Qty left
          </label>
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
            Original qty
          </label>
          <input
            type="number"
            min={1}
            value={initialQty}
            onChange={(e) => setInitialQty(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Cost/unit
          </label>
          <input
            type="number"
            step="0.1"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
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
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Vendor</label>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="input">
            <option value="">— None —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          disabled={pending}
          onClick={handleSave}
          className="rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          disabled={pending}
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-1.5 text-xs font-bold text-ink-muted"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
