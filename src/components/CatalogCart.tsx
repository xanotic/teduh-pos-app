"use client";

import { useMemo, useState, useTransition } from "react";
import type { CartLine, HappyHourSettings, MenuItem, PaymentMethod } from "@/lib/types";
import { fmt } from "@/lib/format";
import { finalizeSale } from "@/lib/actions/sales";
import { cancelHappyHour } from "@/app/(app)/happy-hour/actions";
import {
  calculateHappyHourItemPrice,
  formatTime12h,
  isHappyHourActive,
} from "@/lib/happyHour";

export function CatalogCart({
  items,
  mode,
  happyHour,
}: {
  items: MenuItem[];
  mode: "sell" | "giveaway";
  happyHour?: HappyHourSettings | null;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [happyHourOverride, setHappyHourOverride] = useState<boolean | null>(null);

  const autoHappyHourActive = mode === "sell" && isHappyHourActive(happyHour);
  const isHappyHour = happyHourOverride !== null ? happyHourOverride : autoHappyHourActive;

  function getItemPrice(item: MenuItem): number {
    if (isHappyHour && mode === "sell") {
      return calculateHappyHourItemPrice(item.price, happyHour);
    }
    return item.price;
  }

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
    const effectivePrice = getItemPrice(item);

    if (!(effectivePrice > 0) && !(item.price > 0)) {
      showToast("Set a price for this item first (Menu tab)");
      return;
    }
    const existing = cart.find((l) => l.itemId === item.id);
    if (item.stock != null && (existing?.qty ?? 0) >= item.stock) {
      showToast(
        item.stock === 0
          ? `${item.name} is marked out of stock — adding anyway`
          : `Only ${item.stock} counted in stock for ${item.name} — adding anyway`
      );
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
          price: effectivePrice,
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

  function handleCancelHappyHourGlobal() {
    startTransition(async () => {
      try {
        await cancelHappyHour();
        setCart((prev) =>
          prev.map((line) => {
            const originalItem = items.find((i) => i.id === line.itemId);
            return originalItem ? { ...line, price: originalItem.price } : line;
          })
        );
        showToast("Happy hour cancelled and deactivated");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Failed to cancel happy hour");
      }
    });
  }

  return (
    <div>
      {mode === "sell" && (happyHour?.is_enabled || happyHour?.force_active) && (
        <div
          className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 shadow-sm transition ${
            isHappyHour
              ? "border-accent bg-accent-soft text-ink"
              : "border-border bg-surface text-ink-muted"
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <span className="text-lg">{isHappyHour ? "🎉" : "⏸️"}</span>
            <div>
              {isHappyHour ? (
                <span>
                  <strong className="font-bold text-accent">Happy Hour Active:</strong>{" "}
                  <strong className="text-accent font-extrabold">
                    {happyHour?.discount_type === "percent"
                      ? `${happyHour.discount_percent ?? 0}% OFF all items`
                      : `Flat ${fmt(Number(happyHour?.price ?? 0))} for all items`}
                  </strong>
                  {happyHour?.force_active
                    ? " (Flash sale active)"
                    : ` (until ${formatTime12h(happyHour?.end_time || "")})`}
                </span>
              ) : (
                <span>Happy Hour temporarily paused for this order.</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHappyHourOverride((v) => (v === null ? !autoHappyHourActive : !v))}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-bold text-ink-muted transition hover:text-ink"
            >
              {isHappyHour ? "Pause for this order" : "Apply Happy Hour"}
            </button>
            <button
              type="button"
              onClick={handleCancelHappyHourGlobal}
              disabled={pending}
              className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-bold text-danger transition hover:bg-danger hover:text-white"
              title="Cancel and deactivate Happy Hour storewide"
            >
              End Promo
            </button>
          </div>
        </div>
      )}

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
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border bg-surface text-ink-muted"
                }`}
              >
                {c === "ALL" ? "All" : c.charAt(0) + c.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visible.map((it) => {
              const effectivePrice = getItemPrice(it);

              return (
                <button
                  key={it.id}
                  onClick={() => addToCart(it)}
                  className="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface p-3.5 text-left shadow-sm transition active:scale-95"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                      {it.category}
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
                    {isHappyHour && it.price > 0 && effectivePrice !== it.price ? (
                      <>
                        <span className="text-xs text-ink-muted line-through font-normal">
                          {fmt(it.price)}
                        </span>
                        <span className="text-sm font-extrabold text-accent">
                          {fmt(effectivePrice)}
                        </span>
                        {it.price > effectivePrice && (
                          <span className="rounded bg-success-soft px-1 text-[10px] font-bold text-success">
                            -{Math.round(((it.price - effectivePrice) / it.price) * 100)}%
                          </span>
                        )}
                      </>
                    ) : (
                      <span
                        className={`text-sm font-bold ${
                          effectivePrice > 0 ? "text-accent" : "text-ink-muted"
                        }`}
                      >
                        {effectivePrice > 0 ? fmt(effectivePrice) : "Set price"}
                      </span>
                    )}
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
          <h2 className="mb-3 text-sm font-bold text-ink">
            {mode === "giveaway" ? "Giveaway Cart" : "Current Order"}
          </h2>

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

          {mode === "giveaway" && (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason / recipient (optional)"
              className="input mt-3"
            />
          )}

          <div className="mt-4 flex items-center justify-between text-sm text-ink-muted">
            <span>
              {count} {count === 1 ? "item" : "items"}
            </span>
            <span className="text-lg font-extrabold text-ink">{fmt(total)}</span>
          </div>

          {mode === "sell" ? (
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
          ) : (
            <button
              disabled={!cart.length || pending}
              onClick={() => checkout("Giveaway")}
              className="mt-3 w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-white disabled:opacity-40"
            >
              🎁 Log Giveaway
            </button>
          )}

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
