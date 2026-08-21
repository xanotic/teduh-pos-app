"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function BreakEvenDatePicker({ value }: { value: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <input
      type="date"
      defaultValue={value}
      onChange={(e) => {
        if (!e.target.value) return;
        const params = new URLSearchParams(searchParams.toString());
        params.set("beStart", e.target.value);
        router.push(`/analytics?${params.toString()}`);
      }}
      className="rounded-lg border border-accent bg-accent-soft px-2.5 py-1.5 text-xs text-accent"
    />
  );
}

export function DatePicker({ value, active }: { value: string; active: boolean }) {
  const router = useRouter();

  return (
    <input
      type="date"
      defaultValue={value}
      onChange={(e) => e.target.value && router.push(`/analytics?date=${e.target.value}`)}
      className={`rounded-lg border px-2.5 py-2 text-sm ${
        active ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-ink-muted"
      }`}
    />
  );
}

export function DateRangePicker({
  from,
  to,
  active,
}: {
  from: string;
  to: string;
  active: boolean;
}) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);

  function apply(nextFrom: string, nextTo: string) {
    if (!nextFrom || !nextTo) return;
    router.push(`/analytics?from=${nextFrom}&to=${nextTo}`);
  }

  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${
        active ? "border-accent bg-accent-soft" : "border-border bg-surface"
      }`}
    >
      <input
        type="date"
        value={fromVal}
        onChange={(e) => {
          setFromVal(e.target.value);
          apply(e.target.value, toVal);
        }}
        className={`bg-transparent text-sm ${active ? "text-accent" : "text-ink-muted"}`}
      />
      <span className={`text-xs ${active ? "text-accent" : "text-ink-muted"}`}>–</span>
      <input
        type="date"
        value={toVal}
        onChange={(e) => {
          setToVal(e.target.value);
          apply(fromVal, e.target.value);
        }}
        className={`bg-transparent text-sm ${active ? "text-accent" : "text-ink-muted"}`}
      />
    </div>
  );
}
