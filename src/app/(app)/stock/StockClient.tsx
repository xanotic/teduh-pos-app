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

  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  const filtered = rows.filter((r) => {
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase());
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

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-bold text-ink">Stock Overview</h1>
      <p className="mb-4 text-sm text-ink-muted">
        {dateLabel} · {totalSoldToday} item{totalSoldToday === 1 ? "" : "s"} sold today · read-only —
        to change stock, use Shelf Life.
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search item…"
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
