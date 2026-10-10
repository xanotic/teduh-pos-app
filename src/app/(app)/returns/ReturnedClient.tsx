"use client";

import { useMemo, useState, useTransition } from "react";
import type { MenuItem, ReturnEntry, Vendor } from "@/lib/types";
import { fmt } from "@/lib/format";
import { createReturn, deleteReturn } from "./actions";

export function ReturnedClient({
  items,
  vendors,
  returns,
}: {
  items: MenuItem[];
  vendors: Vendor[];
  returns: ReturnEntry[];
}) {
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [vendorQuery, setVendorQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);
  const itemByName = useMemo(
    () => new Map(items.map((it) => [it.name.trim().toLowerCase(), it])),
    [items]
  );

  const matchedItem = itemByName.get(itemName.trim().toLowerCase()) ?? null;
  const matchVendorName = matchedItem?.vendor_id ? vendorById.get(matchedItem.vendor_id)?.name : null;
  const canLog = !!matchedItem && (matchedItem.stock ?? 0) > 0;

  function handleLog(e: React.FormEvent) {
    e.preventDefault();
    if (!canLog) return;
    const q = parseInt(qty, 10) || 0;
    if (!(q > 0)) {
      setError("Enter a quantity greater than 0.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createReturn({ item: itemName.trim(), qty: q, note });
        setItemName("");
        setQty("1");
        setNote("");
        setSavedMsg("Return logged.");
        setTimeout(() => setSavedMsg(null), 2500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not log return.");
      }
    });
  }

  const trimmedVendorQuery = vendorQuery.trim().toLowerCase();
  const vendorFilter: string =
    trimmedVendorQuery === ""
      ? "all"
      : trimmedVendorQuery === "no vendor"
        ? "none"
        : vendors.find((v) => v.name.toLowerCase() === trimmedVendorQuery)?.id ?? "all";

  const filtered = returns.filter((r) => vendorFilter === "all" || (r.vendor_id ?? "none") === vendorFilter);

  const totalQty = filtered.reduce((s, r) => s + r.qty, 0);
  const totalValue = filtered.reduce((s, r) => s + (r.cost ?? 0) * r.qty, 0);
  const totalUpfrontRefunded = filtered.reduce((s, r) => s + (r.upfront_reversed ?? 0), 0);

  function copyList() {
    const groups = new Map<string, { vendorName: string | null; rows: ReturnEntry[] }>();
    for (const r of filtered) {
      const key = r.vendor_id ?? "none";
      if (!groups.has(key)) {
        groups.set(key, { vendorName: r.vendor_id ? vendorById.get(r.vendor_id)?.name ?? null : null, rows: [] });
      }
      groups.get(key)!.rows.push(r);
    }
    const sortedGroups = Array.from(groups.values())
      .map((g) => ({
        ...g,
        subtotalQty: g.rows.reduce((s, r) => s + r.qty, 0),
        subtotalValue: g.rows.reduce((s, r) => s + (r.cost ?? 0) * r.qty, 0),
      }))
      .sort((a, b) => {
        if (!a.vendorName) return 1;
        if (!b.vendorName) return -1;
        return a.vendorName.localeCompare(b.vendorName);
      });

    const lines = [
      "↩️ Returned to Vendor",
      "",
      ...sortedGroups.flatMap((g, i) => [
        `${i + 1}. ${g.vendorName ?? "No vendor"}`,
        ...g.rows.map((r) => `${r.qty}× ${r.item}${r.cost != null ? ` — ${fmt(r.cost)} each` : ""}`),
        `Subtotal: ${g.subtotalQty} item${g.subtotalQty === 1 ? "" : "s"} · ${fmt(g.subtotalValue)}`,
        "",
      ]),
      `Total: ${totalQty} item${totalQty === 1 ? "" : "s"} · ${fmt(totalValue)}`,
      ...(totalUpfrontRefunded > 0 ? [`Refunded (upfront): ${fmt(totalUpfrontRefunded)}`] : []),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-bold text-ink">Returned</h1>
      <p className="mb-5 text-sm text-ink-muted">
        A vendor picking up unsold stock <strong className="text-ink">before</strong> it expires goes here —
        not a sale, not wastage. It comes straight out of current stock (oldest-expiring batch first, same as
        a sale) so it can&apos;t later get sold against or quietly expire on its own. Upfront items also get
        their cash-paid ledger credited back for what&apos;s returned.
      </p>

      <form onSubmit={handleLog} className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Item
            </label>
            <input
              list="returns-items"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Start typing an item…"
              className="input"
            />
            <datalist id="returns-items">
              {items.map((it) => (
                <option key={it.id} value={it.name} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Qty returned
            </label>
            <input
              type="number"
              step="1"
              min={1}
              max={matchedItem?.stock ?? undefined}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
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
              placeholder="e.g. picked up early"
              className="input"
            />
          </div>
        </div>

        {itemName.trim() && (
          <p className="mb-3 text-xs text-ink-muted">
            {matchedItem ? (
              <>
                {matchVendorName ? (
                  <>
                    Vendor: <strong className="text-ink">{matchVendorName}</strong> ·{" "}
                  </>
                ) : (
                  "No vendor set on Menu · "
                )}
                Currently in stock: <strong className="text-ink">{matchedItem.stock ?? 0}</strong>
                {(matchedItem.stock ?? 0) === 0 && " — nothing to return."}
              </>
            ) : (
              "Not a Shelf-Life tracked item — set a Supply type for it on Menu first."
            )}
          </p>
        )}

        <button
          disabled={pending || !canLog}
          className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Log Return"}
        </button>
        {error && <p className="mt-2 text-xs font-semibold text-danger">{error}</p>}
        {savedMsg && <p className="mt-2 text-xs font-semibold text-success">{savedMsg}</p>}
      </form>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {vendors.length > 0 && (
          <div className="relative w-48">
            <input
              value={vendorQuery}
              onChange={(e) => setVendorQuery(e.target.value)}
              list="returns-vendors"
              placeholder="Filter by vendor…"
              className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink-muted"
            />
            <datalist id="returns-vendors">
              <option value="No vendor" />
              {vendors.map((v) => (
                <option key={v.id} value={v.name} />
              ))}
            </datalist>
            {vendorQuery && (
              <button
                type="button"
                onClick={() => setVendorQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-muted"
              >
                ✕
              </button>
            )}
          </div>
        )}
        <button
          onClick={copyList}
          disabled={filtered.length === 0}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-ink-muted disabled:opacity-40"
        >
          {copied ? "Copied ✓" : "📋 Copy list"}
        </button>
      </div>

      {filtered.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-ink-muted">
          <span>
            {totalQty} item{totalQty === 1 ? "" : "s"} returned · {fmt(totalValue)} value
          </span>
          {totalUpfrontRefunded > 0 && (
            <span className="text-success">{fmt(totalUpfrontRefunded)} refunded (upfront)</span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((r) => (
          <ReturnRow key={r.id} entry={r} vendorName={r.vendor_id ? vendorById.get(r.vendor_id)?.name ?? null : null} />
        ))}
        {returns.length === 0 && <p className="text-sm text-ink-muted">No returns logged yet.</p>}
        {returns.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-ink-muted">No returns match.</p>
        )}
      </div>
    </div>
  );
}

function ReturnRow({ entry, vendorName }: { entry: ReturnEntry; vendorName: string | null }) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateLabel = new Date(entry.created_at).toLocaleString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-extrabold text-accent">{entry.qty}×</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{entry.item}</span>
        {vendorName && (
          <span className="flex-none rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
            {vendorName}
          </span>
        )}
        {entry.payment_type && (
          <span className="flex-none rounded-full bg-surface-alt px-2 py-0.5 text-[10px] font-bold text-ink-muted">
            {entry.payment_type === "upfront" ? "Upfront" : "Consignment"}
          </span>
        )}
        {entry.upfront_reversed != null && (
          <span className="flex-none rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success">
            +{fmt(entry.upfront_reversed)} refunded
          </span>
        )}
        <button
          disabled={pending}
          onClick={() =>
            confirmDelete
              ? startTransition(async () => {
                  try {
                    await deleteReturn(entry.id);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Undo failed — try again.");
                  }
                  setConfirmDelete(false);
                })
              : setConfirmDelete(true)
          }
          className={`flex-none rounded-md px-2 py-1 text-xs font-bold ${
            confirmDelete ? "bg-danger text-white" : "bg-surface-alt text-danger"
          }`}
          title="Undo this return — puts the stock back"
        >
          {confirmDelete ? "Tap again to undo" : "✕"}
        </button>
      </div>
      <div className="mt-1 text-xs text-ink-muted">
        {dateLabel}
        {entry.cost != null && ` · ${fmt(entry.cost)} each`}
        {entry.note ? ` · ${entry.note}` : ""}
      </div>
      {error && <p className="mt-1 text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
