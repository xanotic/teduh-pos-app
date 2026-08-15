"use client";

import { useState } from "react";

export function ChipList({ items, limit = 12 }: { items: string[]; limit?: number }) {
  const [expanded, setExpanded] = useState(false);

  if (!items.length) {
    return <p className="text-sm text-ink-muted">Everything priced has sold at least once in this range.</p>;
  }

  const shown = expanded ? items : items.slice(0, limit);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {shown.map((name, i) => (
        <span key={i} className="rounded-full border border-border bg-bg px-3 py-1.5 text-xs font-semibold text-ink-muted">
          {name}
        </span>
      ))}
      {items.length > limit && (
        <button onClick={() => setExpanded((v) => !v)} className="text-xs font-bold text-accent">
          {expanded ? "Show less" : `See more (${items.length - limit})`}
        </button>
      )}
    </div>
  );
}
