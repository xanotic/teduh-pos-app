import type { MenuItem } from "@/lib/types";

/**
 * For any item ever added through Shelf Life (menu_items.payment_type is set),
 * the Shelf Life batches are the single source of truth for how much is left —
 * not the separate menu_items.stock counter, which could drift out of sync
 * with it (e.g. stock-tracking turned on after batches already existed).
 * Items never touched by Shelf Life keep using their manual stock number as-is.
 */
export function withLiveStock(
  items: MenuItem[],
  shelfLifeEntries: { item: string; qty: number }[]
): MenuItem[] {
  const shelfLifeTotals = new Map<string, number>();
  for (const entry of shelfLifeEntries) {
    const key = entry.item.trim().toLowerCase();
    shelfLifeTotals.set(key, (shelfLifeTotals.get(key) ?? 0) + entry.qty);
  }

  return items.map((item) => {
    if (item.payment_type == null) return item;
    const key = item.name.trim().toLowerCase();
    return { ...item, stock: shelfLifeTotals.get(key) ?? 0 };
  });
}
