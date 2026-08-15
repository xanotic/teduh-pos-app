"use client";

import { useState } from "react";

export function RankList({
  rows,
  limit = 999,
}: {
  rows: { label: string; value: string; sortVal: number }[];
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!rows.length) return <p className="text-sm text-stone-400">No data yet in this range.</p>;

  const shown = expanded ? rows : rows.slice(0, limit);
  const max = Math.max(...rows.map((r) => r.sortVal), 0.0001);

  return (
    <div className="flex flex-col gap-2.5">
      {shown.map((r, i) => (
        <div key={i} className="grid grid-cols-[minmax(70px,0.9fr)_2fr_auto] items-center gap-2.5">
          <span className="truncate text-sm font-semibold text-stone-700">{r.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-rose-900"
              style={{ width: `${Math.max(4, (r.sortVal / max) * 100)}%` }}
            />
          </div>
          <span className="text-right text-xs font-bold text-stone-500">{r.value}</span>
        </div>
      ))}
      {rows.length > limit && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-xs font-bold text-rose-900"
        >
          {expanded ? "Show less" : `See more (${rows.length - limit})`}
        </button>
      )}
    </div>
  );
}
