"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logOut } from "@/app/(auth)/actions";

const TABS = [
  { href: "/sell", label: "Sell" },
  { href: "/history", label: "History" },
  { href: "/analytics", label: "Analytics" },
  { href: "/giveaway", label: "Giveaway" },
  { href: "/shelf-life", label: "Shelf Life" },
  { href: "/menu", label: "Menu" },
];

export function Nav({ businessName }: { businessName: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-extrabold tracking-tight text-accent">{businessName}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">POS</span>
      </div>

      <nav className="order-3 flex w-full gap-1 overflow-x-auto rounded-xl bg-surface-alt p-1 sm:order-none sm:w-auto">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-none rounded-lg px-3.5 py-2 text-sm font-semibold whitespace-nowrap ${
                active ? "bg-accent text-white" : "text-ink-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        <Link
          href="/account"
          className={`text-sm font-semibold ${
            pathname.startsWith("/account") ? "text-accent" : "text-ink-muted hover:text-ink"
          }`}
        >
          Account
        </Link>
        <form action={logOut}>
          <button type="submit" className="text-sm font-semibold text-ink-muted hover:text-ink">
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
