"use client";

import { useMemo, useState } from "react";
import type { Vendor } from "@/lib/types";

interface StockRow {
  id: string;
  name: string;
  category: string;
  stock: number | null;
  soldToday: number;
  vendorId: string | null;
}

export function StockClient({
  rows,
  vendors,
  today,
}: {
  rows: StockRow[];
  vendors: Vendor[];
  today: string;
}) {
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [copied, setCopied] = useState(false);

  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    const vendorName = r.vendorId ? vendorById.get(r.vendorId)?.name ?? "" : "";
    const matchSearch = !q || r.name.toLowerCase().includes(q) || vendorName.toLowerCase().includes(q);
    const matchVendor =
      vendorFilter === "all" ||
      (vendorFilter === "none" ? !r.vendorId : r.vendorId === vendorFilter);
    return matchSearch && matchVendor;
  });

  const byCategory = filtered.reduce<Record<string, StockRow[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  const totalSoldToday = filtered.reduce((s, r) => s + r.soldToday, 0);

  const dateLabel = new Date(today + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const totalStockLeft = filtered.reduce((s, r) => s + (r.stock ?? 0), 0);

  function copyList() {
    const byVendor = new Map<string, { name: string | null; rows: StockRow[] }>();
    for (const r of filtered) {
      const key = r.vendorId ?? "none";
      if (!byVendor.has(key)) byVendor.set(key, { name: r.vendorId ? vendorById.get(r.vendorId)?.name ?? null : null, rows: [] });
      byVendor.get(key)!.rows.push(r);
    }
    const sortedVendors = Array.from(byVendor.values()).sort((a, b) => {
      if (!a.name) return 1;
      if (!b.name) return -1;
      return a.name.localeCompare(b.name);
    });

    const lines = [
      `📦 Stock Left — ${dateLabel}`,
      "",
      ...sortedVendors.flatMap((v) => [
        `-${v.name ?? "No vendor"}-`,
        ...v.rows.map((r) => `${r.name} — ${r.stock == null ? "not tracked" : r.stock}`),
        "",
      ]),
      `Total stock left: ${totalStockLeft}`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-ink">Stock Overview</h1>
        <button
          onClick={copyList}
          disabled={filtered.length === 0}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-ink-muted disabled:opacity-40"
        >
          {copied ? "Copied ✓" : "📋 Copy list"}
        </button>
      </div>
      <p className="mb-4 text-sm text-ink-muted">
        {dateLabel} · {totalSoldToday} item{totalSoldToday === 1 ? "" : "s"} sold today · read-only —
        to change stock, use Shelf Life.
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

      {Object.keys(byCategory)
        .sort()
        .map((cat) => (
          <div key={cat} className="mb-5">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">{cat}</h2>
            <div className="flex flex-col gap-1.5">
              {byCategory[cat].map((r) => {
                const vendorName = r.vendorId ? vendorById.get(r.vendorId)?.name : null;
                return (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{r.name}</span>
                    {vendorName && (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
                        {vendorName}
                      </span>
                    )}
                    <span className="rounded-full bg-surface-alt px-2.5 py-1 text-xs font-bold text-ink-muted">
                      Sold today: {r.soldToday}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        r.stock == null
                          ? "bg-surface-alt text-ink-muted"
                          : r.stock === 0
                            ? "bg-danger-soft text-danger"
                            : r.stock <= 3
                              ? "bg-surface-alt text-gold"
                              : "bg-success-soft text-success"
                      }`}
                    >
                      {r.stock == null ? "Not tracked" : `${r.stock} left`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

      {filtered.length === 0 && <p className="text-sm text-ink-muted">No items match.</p>}
    </div>
  );
}
