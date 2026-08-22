"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmt } from "@/lib/format";

type ItemType = "consignment" | "upfront" | "unknown";

interface SoldRow {
  name: string;
  qty: number;
  cost: number;
  hasMissingCost: boolean;
  type: ItemType;
  vendorName?: string | null;
  sales: { ts: string; qty: number }[];
}

function rmFmt(n: number) {
  return "rm" + (Math.round(n * 100) / 100).toFixed(2);
}

const TYPE_FILTERS: { key: ItemType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "consignment", label: "Consignment" },
  { key: "upfront", label: "Upfront" },
];

const TYPE_BADGE: Record<ItemType, string> = {
  consignment: "bg-accent-soft text-accent",
  upfront: "bg-gold/15 text-gold",
  unknown: "bg-surface-alt text-ink-muted",
};

export function ItemsSoldPanel({
  breakdown,
  date,
  range,
  todayDate,
}: {
  breakdown: SoldRow[];
  date: string | null;
  range: { from: string; to: string } | null;
  todayDate: string;
}) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(range?.from ?? date ?? "");
  const [toVal, setToVal] = useState(range?.to ?? date ?? "");
  const [typeFilter, setTypeFilter] = useState<ItemType | "all">("all");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = typeFilter === "all" ? breakdown : breakdown.filter((r) => r.type === typeFilter);
  const totalQty = filtered.reduce((s, r) => s + r.qty, 0);
  const totalCost = filtered.reduce((s, r) => s + r.cost, 0);
  const anyMissingCost = filtered.some((r) => r.hasMissingCost);

  const label = range
    ? `${fmtShort(range.from)} – ${fmtShort(range.to)}`
    : date
      ? fmtShort(date)
      : `Today · ${fmtShort(todayDate)}`;

  function goDate(d: string) {
    if (!d) return;
    router.push(`/consignment?date=${d}`);
  }

  function goRange(from: string, to: string) {
    if (!from || !to) return;
    router.push(`/consignment?from=${from}&to=${to}`);
  }

  function copyList() {
    const groups = new Map<string, SoldRow[]>();
    for (const r of filtered) {
      const key = r.vendorName ?? "Unassigned";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    const vendorNames = Array.from(groups.keys()).sort((a, b) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });

    const lines = [
      `📦 Items Sold — ${label}${typeFilter !== "all" ? ` (${TYPE_FILTERS.find((t) => t.key === typeFilter)?.label})` : ""}`,
      "",
    ];
    for (const vendorName of vendorNames) {
      const items = groups.get(vendorName)!;
      lines.push(vendorName);
      items.forEach((r, i) => {
        lines.push(`${i + 1}. ${r.name} - ${r.qty} - ${r.hasMissingCost ? "cost not set" : rmFmt(r.cost)}`);
      });
      lines.push(`Total: ${rmFmt(items.reduce((s, r) => s + r.cost, 0))}`);
      lines.push("");
    }
    lines.push(`Grand total: ${totalQty} item${totalQty === 1 ? "" : "s"} · ${fmt(totalCost)}`);
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl bg-surface-alt p-1">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTypeFilter(t.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                typeFilter === t.key ? "bg-accent text-white" : "text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={copyList}
          disabled={filtered.length === 0}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-ink-muted disabled:opacity-40"
        >
          {copied ? "Copied ✓" : "📋 Copy list"}
        </button>
      </div>

      {filtered.length > 0 ? (
        <>
          <div className="flex flex-col gap-1.5">
            {filtered.map((r) => {
              const isOpen = expanded === r.name;
              return (
                <div key={r.name} className="rounded-lg bg-bg px-3 py-1.5">
                  <button
                    onClick={() => setExpanded(isOpen ? null : r.name)}
                    className="flex w-full items-center justify-between gap-2 text-left text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-ink">
                      <span className="font-extrabold text-accent">{r.qty}×</span>
                      <span className="truncate">{r.name}</span>
                      {r.type !== "unknown" && (
                        <span
                          className={`flex-none rounded-full px-1.5 py-0.5 text-[10px] font-bold ${TYPE_BADGE[r.type]}`}
                        >
                          {r.type === "consignment" ? "Consignment" : "Upfront"}
                        </span>
                      )}
                      <span className="flex-none text-ink-muted">{isOpen ? "▲" : "▼"}</span>
                    </span>
                    <span className="flex-none font-bold text-ink-muted">
                      {r.hasMissingCost ? (
                        <span className="text-gold">{r.cost > 0 ? `${fmt(r.cost)}+` : "no cost set"}</span>
                      ) : (
                        fmt(r.cost)
                      )}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="mt-1.5 flex flex-col gap-1 border-t border-border pt-1.5">
                      {r.sales.map((s, i) => (
                        <div key={i} className="flex items-center justify-between text-xs text-ink-muted">
                          <span>{fmtDateTime(s.ts, !!range)}</span>
                          <span className="font-semibold">{s.qty}×</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-sm font-bold text-ink">
            <span>{totalQty} item{totalQty === 1 ? "" : "s"} sold</span>
            <span>{fmt(totalCost)}</span>
          </div>
          {anyMissingCost && (
            <p className="mt-2 text-xs text-gold">
              Some items have no cost set on Menu — their cost isn&apos;t fully counted above.
            </p>
          )}
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

function fmtDateTime(ts: string, includeDate: boolean) {
  return new Date(ts).toLocaleString("en-US", {
    ...(includeDate ? { month: "short", day: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  });
}
