"use client";

import { useRouter } from "next/navigation";

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
