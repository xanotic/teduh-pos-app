import type { MenuItem, ShelfLifeEntry } from "./types";

export interface RestockRow {
  name: string;
  currentQty: number;
  soldLast7d: number;
  vendorId: string | null;
}

/**
 * An item only shows up here if it's actually stock-tracked one way or
 * another — either menu_items.stock is set, or it has ever appeared in
 * Shelf Life (current batches, or historically via a settlement — a batch
 * row gets deleted once it fully sells through, see deductShelfLifeFifo, so
 * "currently has a shelf_life row" alone would miss sold-out items). Made-
 * to-order items with neither are left out entirely — there's nothing to
 * restock for those.
 */
export function computeRestockRows(
  menuItems: MenuItem[],
  shelfLifeEntries: ShelfLifeEntry[],
  historicalShelfLifeNames: string[],
  salesLast7d: { name: string; qty: number }[],
  threshold = 3
): RestockRow[] {
  const shelfQtyMap: Record<string, number> = {};
  const knownNames = new Set<string>();
  shelfLifeEntries.forEach((e) => {
    const key = e.item.trim().toLowerCase();
    shelfQtyMap[key] = (shelfQtyMap[key] || 0) + e.qty;
    knownNames.add(key);
  });
  historicalShelfLifeNames.forEach((n) => knownNames.add(n.trim().toLowerCase()));

  const salesMap: Record<string, number> = {};
  salesLast7d.forEach((row) => {
    const key = row.name.trim().toLowerCase();
    salesMap[key] = (salesMap[key] || 0) + (row.qty || 0);
  });

  return menuItems
    .map((m) => {
      const key = m.name.trim().toLowerCase();
      const trackedViaStock = m.stock != null;
      const trackedViaShelfLife = knownNames.has(key);
      if (!trackedViaStock && !trackedViaShelfLife) return null;

      const currentQty = trackedViaStock ? m.stock! : shelfQtyMap[key] ?? 0;
      if (currentQty > threshold) return null;

      return {
        name: m.name,
        currentQty,
        soldLast7d: salesMap[key] ?? 0,
        vendorId: m.vendor_id ?? null,
      };
    })
    .filter((r): r is RestockRow => r !== null)
    .sort((a, b) => b.soldLast7d - a.soldLast7d || a.currentQty - b.currentQty);
}
