"use client";

import { useState } from "react";

export function ChipList({ items, limit = 12 }: { items: string[]; limit?: number }) {
  const [expanded, setExpanded] = useState(false);

  if (!items.length) {
    return <p className="text-sm text-stone-400">Everything priced has sold at least once in this range.</p>;
  }

  const shown = expanded ? items : items.slice(0, limit);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {shown.map((name, i) => (
        <span key={i} className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-500">
          {name}
        </span>
      ))}
      {items.length > limit && (
        <button onClick={() => setExpanded((v) => !v)} className="text-xs font-bold text-rose-900">
          {expanded ? "Show less" : `See more (${items.length - limit})`}
        </button>
      )}
    </div>
  );
}
