"use client";

import { useMemo, useState, useTransition } from "react";
import type { CartLine, MenuItem, PaymentMethod, Vendor } from "@/lib/types";
import { fmt } from "@/lib/format";
import { finalizeSale } from "@/lib/actions/sales";

export function CatalogCart({
  items,
  vendors = [],
}: {
  items: MenuItem[];
  vendors?: Vendor[];
}) {
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("ALL");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  const visible = items.filter((it) => {
    const matchVendor =
      vendorFilter === "ALL" ||
      (vendorFilter === "NONE" ? !it.vendor_id : it.vendor_id === vendorFilter);
    const matchSearch = !search || it.name.toLowerCase().includes(search.toLowerCase());
    return matchVendor && matchSearch;
  });

  function addToCart(item: MenuItem) {
    if (!(item.price > 0)) {
      showToast("Set a price for this item first (Menu tab)");
      return;
    }
    // stock === 0 is caught by the disabled grid button before this ever runs —
    // this only warns when adding a 2nd+ unit past a low (but nonzero) count.
    const existing = cart.find((l) => l.itemId === item.id);
    if (item.stock != null && item.stock > 0 && (existing?.qty ?? 0) >= item.stock) {
      showToast(`Only ${item.stock} counted in stock for ${item.name} — adding anyway`);
    }
    setCart((prev) => {
      if (existing) {
        return prev.map((l) => (l.itemId === item.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          category: item.category,
          price: item.price,
          cost: item.cost,
          qty: 1,
        },
      ];
    });
  }

  function changeQty(itemId: string, delta: number) {
    if (delta > 0) {
      const item = items.find((i) => i.id === itemId);
      const line = cart.find((l) => l.itemId === itemId);
      if (item && item.stock != null && line && line.qty >= item.stock) {
        showToast(
          item.stock === 0
            ? `${item.name} is marked out of stock — adding anyway`
            : `Only ${item.stock} counted in stock for ${item.name} — adding anyway`
        );
      }
    }
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
        await finalizeSale(paymentMethod, cart);
        setCart([]);
        showToast(`${paymentMethod} sale recorded — ${fmt(total)}`);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item…"
            className="input mb-3"
          />
          {vendors.length > 0 && (
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="input mb-4"
            >
              <option value="ALL">All vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
              <option value="NONE">No vendor</option>
            </select>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visible.map((it) => {
              const soldOut = it.stock === 0;

              return (
                <button
                  key={it.id}
                  onClick={() => !soldOut && addToCart(it)}
                  disabled={soldOut}
                  className={`flex flex-col gap-1.5 rounded-2xl border p-3.5 text-left shadow-sm transition ${
                    soldOut
                      ? "cursor-not-allowed border-border bg-surface-alt opacity-50"
                      : "border-border bg-surface active:scale-95"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                      {it.vendor_id ? vendorById.get(it.vendor_id)?.name ?? "" : ""}
                    </span>
                    {it.stock != null && (
                      <span
                        className={`flex-none rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          it.stock === 0
                            ? "bg-danger-soft text-danger"
                            : it.stock <= 3
                              ? "bg-surface-alt text-gold"
                              : "bg-surface-alt text-ink-muted"
                        }`}
                      >
                        {it.stock === 0 ? "Out" : `${it.stock} left`}
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-semibold text-ink">{it.name}</span>
                  <div className="mt-auto flex items-baseline gap-1.5">
                    <span className={`text-sm font-bold ${it.price > 0 ? "text-accent" : "text-ink-muted"}`}>
                      {it.price > 0 ? fmt(it.price) : "Set price"}
                    </span>
                  </div>
                </button>
              );
            })}
            {visible.length === 0 && (
              <p className="col-span-full text-sm text-ink-muted">No items match.</p>
            )}
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-ink">Current Order</h2>

          <div className="flex flex-col gap-2">
            {cart.map((l) => {
              return (
                <div key={l.itemId} className="flex items-center gap-2 rounded-xl bg-bg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{l.name}</div>
                    <div className="text-xs text-ink-muted">{fmt(l.price)} each</div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-1">
                    <button
                      onClick={() => changeQty(l.itemId, -1)}
                      className="h-6 w-6 rounded-full bg-surface-alt text-sm font-bold"
                    >
                      −
                    </button>
                    <span className="w-4 text-center text-sm font-bold">{l.qty}</span>
                    <button
                      onClick={() => changeQty(l.itemId, 1)}
                      className="h-6 w-6 rounded-full bg-surface-alt text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                  <span className="w-14 text-right text-sm font-bold">{fmt(l.price * l.qty)}</span>
                </div>
              );
            })}
            {cart.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-muted">Tap items to add them.</p>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-ink-muted">
            <span>
              {count} {count === 1 ? "item" : "items"}
            </span>
            <span className="text-lg font-extrabold text-ink">{fmt(total)}</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              disabled={!cart.length || pending}
              onClick={() => checkout("Cash")}
              className="rounded-xl bg-success py-3.5 text-sm font-bold text-white disabled:opacity-40"
            >
              💵 Cash
            </button>
            <button
              disabled={!cart.length || pending}
              onClick={() => checkout("QR Pay")}
              className="rounded-xl bg-gold py-3.5 text-sm font-bold text-white disabled:opacity-40"
            >
              🔳 QR Pay
            </button>
          </div>

          {toast && (
            <div className="mt-3 rounded-lg bg-ink px-3 py-2 text-center text-xs font-semibold text-white">
              {toast}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
