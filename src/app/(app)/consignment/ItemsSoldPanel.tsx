"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { fmt } from "@/lib/format";
import type { Vendor } from "@/lib/types";

type ItemType = "consignment" | "upfront" | "unknown";

interface SoldRow {
  name: string;
  qty: number;
  cost: number;
  hasMissingCost: boolean;
  type: ItemType;
  vendorId: string | null;
  sales: { ts: string; qty: number }[];
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
  vendors = [],
  date,
  range,
  todayDate,
}: {
  breakdown: SoldRow[];
  vendors?: Vendor[];
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
  const [vendorQuery, setVendorQuery] = useState("");

  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  const trimmedVendorQuery = vendorQuery.trim().toLowerCase();
  const vendorFilter: string =
    trimmedVendorQuery === ""
      ? "all"
      : trimmedVendorQuery === "no vendor"
        ? "none"
        : vendors.find((v) => v.name.toLowerCase() === trimmedVendorQuery)?.id ?? "all";

  const activePeriod: "daily" | "weekly" | "monthly" | "custom" = range
    ? weekBounds(todayDate).from === range.from && todayDate === range.to
      ? "weekly"
      : monthBounds(todayDate).from === range.from && todayDate === range.to
        ? "monthly"
        : "custom"
    : !date
      ? "daily"
      : "custom";

  function goWeekly() {
    const { from } = weekBounds(todayDate);
    goRange(from, todayDate);
  }

  function goMonthly() {
    const { from } = monthBounds(todayDate);
    goRange(from, todayDate);
  }

  const filtered = breakdown.filter((r) => {
    const matchType = typeFilter === "all" || r.type === typeFilter;
    const matchVendor = vendorFilter === "all" || (r.vendorId ?? "none") === vendorFilter;
    return matchType && matchVendor;
  });
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
    const groups = new Map<string, { vendorName: string | null; rows: SoldRow[] }>();
    for (const r of filtered) {
      const key = r.vendorId ?? "none";
      if (!groups.has(key)) groups.set(key, { vendorName: r.vendorId ? vendorById.get(r.vendorId)?.name ?? null : null, rows: [] });
      groups.get(key)!.rows.push(r);
    }
    const sortedGroups = Array.from(groups.values())
      .map((g) => ({
        ...g,
        subtotalQty: g.rows.reduce((s, r) => s + r.qty, 0),
        subtotalCost: g.rows.reduce((s, r) => s + r.cost, 0),
        anyMissingCost: g.rows.some((r) => r.hasMissingCost),
      }))
      .sort((a, b) => {
        if (!a.vendorName) return 1;
        if (!b.vendorName) return -1;
        return a.vendorName.localeCompare(b.vendorName);
      });

    const copiedQty = sortedGroups.reduce((s, g) => s + g.subtotalQty, 0);
    const copiedCost = sortedGroups.reduce((s, g) => s + g.subtotalCost, 0);

    const lines = [
      `📦 Items Sold — ${label}${typeFilter !== "all" ? ` (${TYPE_FILTERS.find((t) => t.key === typeFilter)?.label})` : ""}`,
      "",
      ...sortedGroups.flatMap((g, i) => [
        `${i + 1}. ${g.vendorName ?? "No vendor"}`,
        ...g.rows.map((r) => `${r.qty}× ${r.name} — ${r.hasMissingCost ? "cost not set" : fmt(r.cost)}`),
        `Subtotal: ${g.subtotalQty} item${g.subtotalQty === 1 ? "" : "s"} · ${g.anyMissingCost ? `${fmt(g.subtotalCost)}+` : fmt(g.subtotalCost)}`,
        "",
      ]),
      `Total: ${copiedQty} item${copiedQty === 1 ? "" : "s"} · ${fmt(copiedCost)}`,
    ];
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
          <div className="flex gap-1 rounded-lg bg-surface-alt p-1">
            <button
              onClick={() => router.push("/consignment")}
              className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                activePeriod === "daily" ? "bg-accent text-white" : "text-ink-muted"
              }`}
            >
              Daily
            </button>
            <button
              onClick={goWeekly}
              className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                activePeriod === "weekly" ? "bg-accent text-white" : "text-ink-muted"
              }`}
            >
              Weekly
            </button>
            <button
              onClick={goMonthly}
              className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                activePeriod === "monthly" ? "bg-accent text-white" : "text-ink-muted"
              }`}
            >
              Monthly
            </button>
          </div>
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
        <div className="flex items-center gap-1.5">
          {vendors.length > 0 && (
            <div className="relative">
              <input
                value={vendorQuery}
                onChange={(e) => setVendorQuery(e.target.value)}
                list="items-sold-vendors"
                placeholder="All vendors"
                title="Filter the list — and Copy list — to one vendor"
                className="w-36 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink-muted"
              />
              <datalist id="items-sold-vendors">
                <option value="No vendor" />
                {vendors.map((v) => (
                  <option key={v.id} value={v.name} />
                ))}
              </datalist>
              {vendorQuery && (
                <button
                  type="button"
                  onClick={() => setVendorQuery("")}
                  title="Clear vendor filter"
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

function weekBounds(todayDate: string) {
  const d = new Date(todayDate + "T00:00:00");
  d.setDate(d.getDate() - 6);
  return { from: d.toISOString().slice(0, 10) };
}

function monthBounds(todayDate: string) {
  const d = new Date(todayDate + "T00:00:00");
  return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01` };
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
