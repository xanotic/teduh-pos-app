"use client";

import { useMemo, useState, useTransition } from "react";
import type { CartLine, MenuItem, PaymentMethod } from "@/lib/types";
import { fmt } from "@/lib/format";
import { finalizeSale } from "@/lib/actions/sales";

export function CatalogCart({ items, mode }: { items: MenuItem[]; mode: "sell" | "giveaway" }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    return ["ALL", ...Array.from(set)];
  }, [items]);

  const visible = items.filter((it) => {
    const matchCat = category === "ALL" || it.category === category;
    const matchSearch = !search || it.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  function addToCart(item: MenuItem) {
    if (!(item.price > 0)) {
      showToast("Set a price for this item first (Menu tab)");
      return;
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === item.id);
      if (existing) {
        return prev.map((l) => (l.itemId === item.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        { itemId: item.id, name: item.name, category: item.category, price: item.price, cost: item.cost, qty: 1 },
      ];
    });
  }

  function changeQty(itemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    );
  }

  const total = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const count = cart.reduce((s, l) => s + l.qty, 0);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  function checkout(paymentMethod: PaymentMethod) {
    if (!cart.length) return;
    startTransition(async () => {
      try {
        await finalizeSale(paymentMethod, cart, mode === "giveaway" ? note : undefined);
        setCart([]);
        setNote("");
        showToast(
          mode === "giveaway"
            ? `Giveaway logged — you pay in ${fmt(total)}`
            : `${paymentMethod} sale recorded — ${fmt(total)}`
        );
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search item…"
          className="input mb-3"
        />
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`flex-none rounded-full border px-3.5 py-1.5 text-xs font-bold whitespace-nowrap ${
                category === c
                  ? "border-rose-800 bg-rose-50 text-rose-900"
                  : "border-stone-200 bg-white text-stone-500"
              }`}
            >
              {c === "ALL" ? "All" : c.charAt(0) + c.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visible.map((it) => (
            <button
              key={it.id}
              onClick={() => addToCart(it)}
              className="flex flex-col gap-1.5 rounded-2xl border border-stone-200 bg-white p-3.5 text-left shadow-sm active:scale-95"
            >
              <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                {it.category}
              </span>
              <span className="text-sm font-semibold text-stone-800">{it.name}</span>
              <span className={`mt-auto text-sm font-bold ${it.price > 0 ? "text-rose-900" : "text-stone-400"}`}>
                {it.price > 0 ? fmt(it.price) : "Set price"}
              </span>
            </button>
          ))}
          {visible.length === 0 && (
            <p className="col-span-full text-sm text-stone-400">No items match.</p>
          )}
        </div>
      </div>

      <aside className="h-fit rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-stone-800">
          {mode === "giveaway" ? "Giveaway Cart" : "Current Order"}
        </h2>

        <div className="flex flex-col gap-2">
          {cart.map((l) => (
            <div key={l.itemId} className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-semibold text-stone-800">{l.name}</div>
                <div className="text-xs text-stone-400">{fmt(l.price)} each</div>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-1">
                <button onClick={() => changeQty(l.itemId, -1)} className="h-6 w-6 rounded-full bg-stone-100 text-sm font-bold">
                  −
                </button>
                <span className="w-4 text-center text-sm font-bold">{l.qty}</span>
                <button onClick={() => changeQty(l.itemId, 1)} className="h-6 w-6 rounded-full bg-stone-100 text-sm font-bold">
                  +
                </button>
              </div>
              <span className="w-14 text-right text-sm font-bold">{fmt(l.price * l.qty)}</span>
            </div>
          ))}
          {cart.length === 0 && (
            <p className="py-6 text-center text-sm text-stone-400">Tap items to add them.</p>
          )}
        </div>

        {mode === "giveaway" && (
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason / recipient (optional)"
            className="input mt-3"
          />
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-stone-500">
          <span>{count} {count === 1 ? "item" : "items"}</span>
          <span className="text-lg font-extrabold text-stone-900">{fmt(total)}</span>
        </div>

        {mode === "sell" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              disabled={!cart.length || pending}
              onClick={() => checkout("Cash")}
              className="rounded-xl bg-emerald-700 py-3.5 text-sm font-bold text-white disabled:opacity-40"
            >
              💵 Cash
            </button>
            <button
              disabled={!cart.length || pending}
              onClick={() => checkout("QR Pay")}
              className="rounded-xl bg-amber-600 py-3.5 text-sm font-bold text-white disabled:opacity-40"
            >
              🔳 QR Pay
            </button>
          </div>
        ) : (
          <button
            disabled={!cart.length || pending}
            onClick={() => checkout("Giveaway")}
            className="mt-3 w-full rounded-xl bg-rose-900 py-3.5 text-sm font-bold text-white disabled:opacity-40"
          >
            🎁 Log Giveaway
          </button>
        )}

        {toast && (
          <div className="mt-3 rounded-lg bg-stone-900 px-3 py-2 text-center text-xs font-semibold text-white">
            {toast}
          </div>
        )}
      </aside>
    </div>
  );
}
