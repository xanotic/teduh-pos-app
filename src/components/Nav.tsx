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
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-extrabold tracking-tight text-rose-900">{businessName}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">POS</span>
      </div>

      <nav className="order-3 flex w-full gap-1 overflow-x-auto rounded-xl bg-stone-100 p-1 sm:order-none sm:w-auto">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-none rounded-lg px-3.5 py-2 text-sm font-semibold whitespace-nowrap ${
                active ? "bg-rose-900 text-white" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <form action={logOut}>
        <button type="submit" className="text-sm font-semibold text-stone-400 hover:text-stone-700">
          Log out
        </button>
      </form>
    </header>
  );
}
