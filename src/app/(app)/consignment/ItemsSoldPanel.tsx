"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmt } from "@/lib/format";

interface SoldRow {
  name: string;
  qty: number;
  revenue: number;
}

export function ItemsSoldPanel({
  breakdown,
  date,
  range,
}: {
  breakdown: SoldRow[];
  date: string | null;
  range: { from: string; to: string } | null;
}) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(range?.from ?? date ?? "");
  const [toVal, setToVal] = useState(range?.to ?? date ?? "");

  const totalQty = breakdown.reduce((s, r) => s + r.qty, 0);
  const totalRevenue = breakdown.reduce((s, r) => s + r.revenue, 0);

  const label = range
    ? `${fmtShort(range.from)} – ${fmtShort(range.to)}`
    : date
      ? fmtShort(date)
      : "Today";

  function goDate(d: string) {
    if (!d) return;
    router.push(`/consignment?date=${d}`);
  }

  function goRange(from: string, to: string) {
    if (!from || !to) return;
    router.push(`/consignment?from=${from}&to=${to}`);
  }

  return (
    <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">📦 Items Sold — {label}</h2>
          <p className="text-xs text-ink-muted">One-click view of what actually sold on the POS.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => router.push("/consignment")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
              !date && !range ? "bg-accent text-white" : "border border-border text-ink-muted"
            }`}
          >
            Today
          </button>
          <input
            type="date"
            value={date ?? ""}
            onChange={(e) => goDate(e.target.value)}
            className={`rounded-lg border px-2 py-1.5 text-xs ${
              date ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-ink-muted"
            }`}
          />
          <div
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 ${
              range ? "border-accent bg-accent-soft" : "border-border bg-surface"
            }`}
          >
            <input
              type="date"
              value={fromVal}
              onChange={(e) => {
                setFromVal(e.target.value);
                goRange(e.target.value, toVal);
              }}
              className={`bg-transparent text-xs ${range ? "text-accent" : "text-ink-muted"}`}
            />
            <span className={`text-xs ${range ? "text-accent" : "text-ink-muted"}`}>–</span>
            <input
              type="date"
              value={toVal}
              onChange={(e) => {
                setToVal(e.target.value);
                goRange(fromVal, e.target.value);
              }}
              className={`bg-transparent text-xs ${range ? "text-accent" : "text-ink-muted"}`}
            />
          </div>
        </div>
      </div>

      {breakdown.length > 0 ? (
        <>
          <div className="flex flex-col gap-1.5">
            {breakdown.map((r) => (
              <div key={r.name} className="flex items-center justify-between rounded-lg bg-bg px-3 py-1.5 text-sm">
                <span className="text-ink">
                  <span className="font-extrabold text-accent">{r.qty}×</span> {r.name}
                </span>
                <span className="font-bold text-ink-muted">{fmt(r.revenue)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-sm font-bold text-ink">
            <span>{totalQty} item{totalQty === 1 ? "" : "s"} sold</span>
            <span>{fmt(totalRevenue)}</span>
          </div>
        </>
      ) : (
        <p className="text-sm text-ink-muted">No sales in this period.</p>
      )}
    </div>
  );
}

function fmtShort(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
