import type { MenuItem } from "@/lib/types";

// Malaysia is UTC+8 with no DST — same explicit-offset approach used across
// History/Analytics/Consignment/Shelf Life.
const MY_OFFSET_MS = 8 * 60 * 60 * 1000;

function todayInMalaysia(): string {
  return new Date(Date.now() + MY_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * For any item ever added through Shelf Life (menu_items.payment_type is set),
 * the Shelf Life batches are the single source of truth for how much is left —
 * not the separate menu_items.stock counter, which could drift out of sync
 * with it (e.g. stock-tracking turned on after batches already existed).
 * Items never touched by Shelf Life keep using their manual stock number as-is.
 *
 * Expired batches are excluded from the sum — the expiry sweep only zeroes
 * out menu_items.stock (now cosmetic for these items) and flags
 * stock_deducted, it never touches the batch's own qty, so an expired batch
 * would otherwise keep counting as sellable stock forever.
 */
export function withLiveStock(
  items: MenuItem[],
  shelfLifeEntries: { item: string; qty: number; expires_at: string }[]
): MenuItem[] {
  const today = todayInMalaysia();
  const shelfLifeTotals = new Map<string, number>();
  for (const entry of shelfLifeEntries) {
    if (entry.expires_at < today) continue;
    const key = entry.item.trim().toLowerCase();
    shelfLifeTotals.set(key, (shelfLifeTotals.get(key) ?? 0) + entry.qty);
  }

  return items.map((item) => {
    if (item.payment_type == null) return item;
    const key = item.name.trim().toLowerCase();
    return { ...item, stock: shelfLifeTotals.get(key) ?? 0 };
  });
}
