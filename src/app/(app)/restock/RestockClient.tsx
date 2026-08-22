"use client";

import { useMemo, useState } from "react";
import type { RestockRow } from "@/lib/restock";
import type { Vendor } from "@/lib/types";

export function RestockClient({ rows, vendors }: { rows: RestockRow[]; vendors: Vendor[] }) {
  const [copied, setCopied] = useState(false);
  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  const groups = useMemo(() => {
    const map = new Map<string, { vendor: Vendor | null; rows: RestockRow[] }>();
    for (const r of rows) {
      const key = r.vendorId ?? "none";
      if (!map.has(key)) map.set(key, { vendor: r.vendorId ? vendorById.get(r.vendorId) ?? null : null, rows: [] });
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values()).sort((a, b) => (a.vendor ? 0 : 1) - (b.vendor ? 0 : 1));
  }, [rows, vendorById]);

  function copyList() {
    const lines = ["🛒 Need Restock", ""];
    for (const g of groups) {
      lines.push(g.vendor ? g.vendor.name : "No vendor set");
      g.rows.forEach((r) => {
        const status = r.currentQty <= 0 ? "out of stock" : `${r.currentQty} left`;
        const velocity = r.soldLast7d > 0 ? `, sold ${r.soldLast7d} last 7d` : "";
        lines.push(`- ${r.name} (${status}${velocity})`);
      });
      lines.push("");
    }
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Restock</h1>
          <p className="text-sm text-ink-muted">
            Items running low or already out, sorted by how fast they&apos;ve been selling — highest priority first.
          </p>
        </div>
        {rows.length > 0 && (
          <button
            onClick={copyList}
            className="flex-none rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-ink-muted"
          >
            {copied ? "Copied ✓" : "📋 Copy list"}
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-ink-muted shadow-sm">
          Nothing needs restocking right now. 🎉
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => {
            const key = g.vendor?.id ?? "none";
            return (
              <div key={key} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-ink">{g.vendor ? g.vendor.name : "No vendor set"}</span>
                  <span className="text-xs text-ink-muted">
                    {g.rows.length} item{g.rows.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {g.rows.map((r) => (
                    <div
                      key={r.name}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate font-semibold text-ink">{r.name}</span>
                      <div className="flex flex-none items-center gap-2">
                        {r.soldLast7d > 0 && (
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
                            sold {r.soldLast7d} / 7d
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            r.currentQty <= 0 ? "bg-danger-soft text-danger" : "bg-surface-alt text-gold"
                          }`}
                        >
                          {r.currentQty <= 0 ? "Out of stock" : `${r.currentQty} left`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
