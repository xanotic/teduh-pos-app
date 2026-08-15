"use client";

import { useState } from "react";
import { RankList } from "./RankList";
import { fmt } from "@/lib/format";

export function TopItemsPanel({ byItem }: { byItem: { name: string; qty: number; revenue: number }[] }) {
  const [sort, setSort] = useState<"revenue" | "qty">("revenue");

  const sorted = [...byItem].sort((a, b) => b[sort] - a[sort]);
  const rows = sorted.map((it) => ({
    label: it.name,
    value: sort === "revenue" ? fmt(it.revenue) : `${it.qty} sold`,
    sortVal: it[sort],
  }));

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-stone-800">Top Items</h3>
        <div className="flex gap-1 rounded-lg bg-stone-100 p-1">
          {(["revenue", "qty"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                sort === s ? "bg-rose-900 text-white" : "text-stone-500"
              }`}
            >
              {s === "revenue" ? "Revenue" : "Qty"}
            </button>
          ))}
        </div>
      </div>
      <RankList rows={rows} limit={6} />
    </div>
  );
}
