"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import JsBarcode from "jsbarcode";
import type { MenuItem, PaymentType, Vendor } from "@/lib/types";
import { addMenuItem, deleteMenuItem, resetAllStock, updateMenuItem } from "./actions";
import { resetItemBatches } from "../shelf-life/actions";
import { importLegacyBackup } from "./importActions";
import { skuToBarcode } from "@/lib/itemQr";

const SUPPLY_LABEL: Record<PaymentType, string> = {
  consignment: "Consignment",
  upfront: "Upfront",
};

export function MenuClient({ items, vendors = [] }: { items: MenuItem[]; vendors?: Vendor[] }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("");
  const [paymentType, setPaymentType] = useState<"" | PaymentType>("");
  const [vendorId, setVendorId] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importPending, startImport] = useTransition();
  const [importResult, setImportResult] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [resetPending, startResetTransition] = useTransition();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  const filtered = items.filter((it) => {
    const q = search.trim().toLowerCase();
    const itVendorName = it.vendor_id ? vendorById.get(it.vendor_id)?.name ?? "" : "";
    const matchSearch = !q || it.name.toLowerCase().includes(q) || itVendorName.toLowerCase().includes(q);
    const matchVendor =
      vendorFilter === "all" || (vendorFilter === "none" ? !it.vendor_id : it.vendor_id === vendorFilter);
    return matchSearch && matchVendor;
  });

  const byVendor = filtered.reduce<Record<string, MenuItem[]>>((acc, it) => {
    const key = it.vendor_id ?? "none";
    (acc[key] ??= []).push(it);
    return acc;
  }, {});

  const sortedVendorKeys = Object.keys(byVendor).sort((a, b) => {
    const nameA = a === "none" ? null : vendorById.get(a)?.name;
    const nameB = b === "none" ? null : vendorById.get(b)?.name;
    if (!nameA) return 1;
    if (!nameB) return -1;
    return nameA.localeCompare(nameB);
  });

  const missingCostCount = items.filter((it) => it.price > 0 && it.cost == null).length;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      await addMenuItem({
        name: name.trim(),
        price: parseFloat(price) || 0,
        cost: cost === "" ? null : parseFloat(cost) || 0,
        stock: stock === "" ? null : parseInt(stock, 10) || 0,
        paymentType: paymentType || null,
        vendorId: vendorId || null,
        vendorName: vendorId ? vendorById.get(vendorId)?.name ?? null : null,
      });
      setName("");
      setPrice("");
      setCost("");
      setStock("");
      setPaymentType("");
      setVendorId("");
    });
  }

  function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    startResetTransition(async () => {
      try {
        await resetAllStock();
        setResetMsg("All stock reset to 0.");
        setTimeout(() => setResetMsg(null), 2500);
      } catch (e) {
        setResetMsg(e instanceof Error ? e.message : "Reset failed — try again.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-bold text-ink">Manage Menu</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Add items, set prices, or remove things you no longer sell.
      </p>

      {missingCostCount > 0 && (
        <div className="mb-5 rounded-xl border border-gold bg-surface-alt px-3 py-2 text-xs font-semibold text-gold">
          {missingCostCount} priced item{missingCostCount === 1 ? "" : "s"} {missingCostCount === 1 ? "has" : "have"} no
          cost set (outlined below) — their sales are left out of Est. Profit on Analytics.
        </div>
      )}

      <div className="mb-5 flex items-center gap-2">
        <button
          disabled={resetPending}
          onClick={handleReset}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 ${
            confirmReset ? "bg-danger text-white" : "border border-danger text-danger"
          }`}
        >
          {resetPending
            ? "Resetting…"
            : confirmReset
              ? "Tap again to confirm — reset ALL plain-stock items to 0"
              : "Reset all stock to 0"}
        </button>
        {confirmReset && (
          <button
            onClick={() => setConfirmReset(false)}
            className="flex-none rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-ink-muted"
          >
            Cancel
          </button>
        )}
      </div>
      {resetMsg && <p className="-mt-3 mb-5 text-xs font-semibold text-ink-muted">{resetMsg}</p>}

      <form
        onSubmit={handleAdd}
        className="mb-6 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:grid-cols-5 sm:items-end"
      >
        <Field label="Item name" className="col-span-2 sm:col-span-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tiramisu Cake"
            className="input"
          />
        </Field>
        <Field label="Price (RM)">
          <input
            type="number"
            step="0.1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Cost (RM)">
          <input
            type="number"
            step="0.1"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Stock">
          <input
            type="number"
            step="1"
            min="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="—"
            className="input"
          />
        </Field>
        <Field label="Supply type">
          <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as "" | PaymentType)} className="input">
            <option value="">Not tracked</option>
            <option value="consignment">Consignment</option>
            <option value="upfront">Upfront</option>
          </select>
        </Field>
        <Field label="Vendor">
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="input">
            <option value="">— None —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <button
          disabled={pending}
          className="col-span-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-strong disabled:opacity-50 sm:col-span-5"
        >
          Add item
        </button>
      </form>
      <p className="-mt-4 mb-6 text-xs text-ink-muted">
        Supply type and vendor are set here only — this is what Shelf Life and Consignment use to know
        who supplies an item and how it&apos;s paid for.
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search item or vendor…"
        className="input mb-3"
      />

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

      {sortedVendorKeys.map((key) => (
        <div key={key} className="mb-5">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
            {key === "none" ? "No vendor" : vendorById.get(key)?.name ?? "No vendor"}
          </h2>
          <div className="flex flex-col gap-1.5">
            {byVendor[key].map((it) => (
              <MenuRow
                key={it.id}
                item={it}
                vendors={vendors}
                confirming={confirmId === it.id}
                onDeleteClick={() =>
                  confirmId === it.id
                    ? startTransition(async () => {
                        await deleteMenuItem(it.id);
                        setConfirmId(null);
                      })
                    : setConfirmId(it.id)
                }
              />
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="text-sm text-ink-muted">
          {items.length === 0 ? "No menu items yet — add your first one above." : "No items match."}
        </p>
      )}

      <div className="mt-8 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-bold text-ink">Import from old backup</h2>
        <p className="mb-3 text-xs text-ink-muted">
          Paste the JSON from a &quot;Back Up to Google Drive&quot; snapshot from the old app. Menu items
          are matched by name (updates price/cost if already here, adds if new); every transaction in
          the file gets imported fresh — only run this once per file, or sales will be duplicated.
        </p>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Paste backup JSON here…"
          className="input mb-2 min-h-[100px] font-mono text-xs"
        />
        <button
          disabled={importPending || !importText.trim()}
          onClick={() =>
            startImport(async () => {
              try {
                const res = await importLegacyBackup(importText);
                setImportResult(
                  `Imported: ${res.itemsAdded} new item(s), ${res.itemsUpdated} price/cost update(s), ${res.txnsImported} transaction(s).`
                );
                setImportText("");
              } catch (e) {
                setImportResult(e instanceof Error ? e.message : "Import failed.");
              }
            })
          }
          className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Import
        </button>
        {importResult && <p className="mt-2 text-xs font-semibold text-ink-muted">{importResult}</p>}
      </div>
    </div>
  );
}

function MenuRow({
  item,
  vendors,
  confirming,
  onDeleteClick,
}: {
  item: MenuItem;
  vendors: Vendor[];
  confirming: boolean;
  onDeleteClick: () => void;
}) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resetPending, startResetTransition] = useTransition();
  const [confirmZero, setConfirmZero] = useState(false);
  const [showQr, setShowQr] = useState(false);

  function save(patch: Parameters<typeof updateMenuItem>[1], revert: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await updateMenuItem(item.id, patch);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed — try again.");
        revert();
      }
    });
  }

  function handleZero() {
    if (!confirmZero) {
      setConfirmZero(true);
      return;
    }
    setConfirmZero(false);
    setError(null);
    startResetTransition(async () => {
      try {
        await resetItemBatches(item.name);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Reset failed — try again.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          defaultValue={item.name}
          placeholder="Name"
          onBlur={(e) => {
            const v = e.target.value.trim();
            const el = e.target;
            if (v && v !== item.name) save({ name: v }, () => (el.value = item.name));
            else el.value = item.name;
          }}
          className="min-w-[120px] flex-1 rounded-md border border-border bg-bg px-2 py-1 text-sm font-semibold text-ink"
        />
        <input
          type="number"
          step="0.1"
          defaultValue={item.price || ""}
          placeholder="Price"
          onBlur={(e) => {
            const el = e.target;
            save({ price: parseFloat(el.value) || 0 }, () => (el.value = String(item.price || "")));
          }}
          className="w-20 flex-none rounded-md border border-border px-2 py-1 text-right text-sm"
        />
        <input
          type="number"
          step="0.1"
          defaultValue={item.cost ?? ""}
          placeholder="Cost"
          onBlur={(e) => {
            const el = e.target;
            save({ cost: el.value === "" ? null : parseFloat(el.value) || 0 }, () => (el.value = item.cost != null ? String(item.cost) : ""));
          }}
          className={`w-20 flex-none rounded-md border px-2 py-1 text-right text-sm ${
            item.cost == null ? "border-gold" : "border-border"
          }`}
          title={item.cost == null ? "No cost set — Est. Profit on Analytics excludes this item's sales" : undefined}
        />
        {item.payment_type != null ? (
          <span
            title="This item is tracked in Shelf Life — add a new batch there when your supplier delivers, don't edit the number here"
            className={`w-20 flex-none rounded-md border border-dashed px-2 py-1 text-right text-sm ${
              item.stock === 0
                ? "border-danger text-danger"
                : item.stock != null && item.stock <= 3
                  ? "border-gold text-gold"
                  : "border-border text-ink-muted"
            }`}
          >
            {item.stock ?? 0} 🔗
          </span>
        ) : null}
        {item.payment_type != null && (item.stock ?? 0) > 0 && (
          <button
            type="button"
            disabled={resetPending}
            onClick={handleZero}
            title="Wipes all current Shelf Life batches for this item — use for wastage/breakage, not a normal sale"
            className={`flex-none rounded-md px-2 py-1 text-[11px] font-bold disabled:opacity-50 ${
              confirmZero ? "bg-danger text-white" : "bg-surface-alt text-danger"
            }`}
          >
            {resetPending ? "…" : confirmZero ? "Confirm reset to 0" : "Reset to 0"}
          </button>
        )}
        {item.payment_type == null && (
          <input
            type="number"
            step="1"
            min="0"
            defaultValue={item.stock ?? ""}
            placeholder="Stock"
            onBlur={(e) => {
              const el = e.target;
              save(
                { stock: el.value === "" ? null : parseInt(el.value, 10) || 0 },
                () => (el.value = item.stock != null ? String(item.stock) : "")
              );
            }}
            className={`w-20 flex-none rounded-md border px-2 py-1 text-right text-sm ${
              item.stock === 0
                ? "border-danger text-danger"
                : item.stock != null && item.stock <= 3
                  ? "border-gold text-gold"
                  : "border-border"
            }`}
          />
        )}
        <select
          defaultValue={item.payment_type ?? ""}
          onChange={(e) => {
            const v = e.target.value as "" | PaymentType;
            save({ payment_type: v || null }, () => {});
          }}
          className="flex-none rounded-md border border-border bg-bg px-1.5 py-1 text-[11px] font-bold text-ink-muted"
          title="Supply type — Consignment or Upfront?"
        >
          <option value="">Not tracked</option>
          <option value="consignment">Consignment</option>
          <option value="upfront">Upfront</option>
        </select>
        <select
          defaultValue={item.vendor_id ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            save({ vendor_id: v || null }, () => {});
          }}
          className="flex-none rounded-md border border-border bg-bg px-1.5 py-1 text-[11px] text-ink-muted"
          title="Vendor"
        >
          <option value="">No vendor</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <button
          onClick={onDeleteClick}
          className={`flex-none rounded-md px-2 py-1 text-xs font-bold ${
            confirming ? "bg-danger text-white" : "bg-surface-alt text-danger"
          }`}
        >
          {confirming ? "✔" : "✕"}
        </button>
        <button
          type="button"
          onClick={() => setShowQr(true)}
          className="flex-none rounded-md bg-surface-alt px-2 py-1 text-[11px] font-bold text-ink-muted"
          title="Print a scannable label for this item"
        >
          🏷 Barcode
        </button>
      </div>
      {error && <p className="mt-1 text-xs font-semibold text-danger">{error}</p>}
      {showQr && <QrLabelModal item={item} onClose={() => setShowQr(false)} />}
    </div>
  );
}

function QrLabelModal({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    buildLabel(item).then(setDataUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // Real label is 12mm (tall) x 40mm (wide) — drawn at 20px/mm so the printed
  // result stays sharp. A 1D barcode (Code128) is used instead of a QR here:
  // for the same physical size, 1D bars can be drawn much wider per encoded
  // character than a QR's modules, which is what actually lets a scanner read
  // it from further away — the tradeoff is it needs a short code, which is
  // why each item gets a short numeric sku instead of encoding its full uuid.
  async function buildLabel(item: MenuItem) {
    const PX_PER_MM = 20;
    const W = 40 * PX_PER_MM; // 800
    const H = 12 * PX_PER_MM; // 240
    const PAD = 10;
    const nameRowH = 46;
    const priceRowH = 40;
    const barcodeMaxH = H - nameRowH - priceRowH;

    const barcodeCanvas = document.createElement("canvas");
    JsBarcode(barcodeCanvas, skuToBarcode(item.sku), {
      format: "CODE128",
      displayValue: false,
      margin: 0,
      width: 6, // as wide as possible per bar — the whole point of switching off QR
      height: barcodeMaxH,
      background: "#ffffff",
      lineColor: "#000000",
    });

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";

    // Name, centered, shrunk to fit on one line.
    const nameSize = fitFontSize(ctx, item.name, W - PAD * 2, 32, 18);
    ctx.font = `bold ${nameSize}px sans-serif`;
    ctx.fillText(truncateToWidth(ctx, item.name, W - PAD * 2), W / 2, 30);

    // Barcode, scaled down only if it doesn't already fit (never upscaled,
    // which would just blur the bars instead of helping).
    const availableW = W - PAD * 2;
    const scale = Math.min(1, availableW / barcodeCanvas.width);
    const destW = barcodeCanvas.width * scale;
    const destH = barcodeCanvas.height * scale;
    ctx.drawImage(barcodeCanvas, (W - destW) / 2, nameRowH, destW, destH);

    if (item.price > 0) {
      ctx.font = "bold 28px sans-serif";
      ctx.fillText(`RM ${item.price.toFixed(2)}`, W / 2, H - 10);
    }

    return canvas.toDataURL("image/png");
  }

  // Shrinks the font until the text fits on one line, down to a floor size.
  function fitFontSize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, minSize: number) {
    let size = startSize;
    while (size > minSize) {
      ctx.font = `bold ${size}px sans-serif`;
      if (ctx.measureText(text).width <= maxWidth) return size;
      size -= 2;
    }
    return minSize;
  }

  function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return `${truncated}…`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-2xl bg-surface p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-sm font-bold text-ink">Label — {item.name}</h3>
        {dataUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrl}
              alt={`Barcode label for ${item.name}`}
              className="mb-3 w-full rounded-lg border border-border bg-white object-contain"
            />
            <p className="mb-2 text-[11px] text-ink-muted">Sized for a 12mm × 40mm label.</p>
            <a
              href={dataUrl}
              download={`${item.name.replace(/[^a-z0-9]+/gi, "-")}-label.png`}
              className="mb-2 block rounded-lg bg-accent px-4 py-2 text-center text-sm font-bold text-white"
            >
              Download label (PNG)
            </a>
            <p className="mb-3 text-xs text-ink-muted">
              Download, then open it in the Niimbot app (import from gallery) and print as usual.
            </p>
          </>
        ) : (
          <p className="mb-3 text-sm text-ink-muted">Generating…</p>
        )}
        <button onClick={onClose} className="w-full rounded-lg border border-border py-2 text-sm font-bold text-ink-muted">
          Close
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
