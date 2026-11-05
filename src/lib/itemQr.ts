// Every printed label encodes a short "T<5-digit sku>" code as a 1D barcode —
// short enough that the bars print wide on a 12x40mm label, which is what
// makes it readable by a scanner from a distance. The old "TEDUH-ITEM:<uuid>"
// QR format is kept here too so any labels already printed before this
// switch still scan correctly.
export const ITEM_QR_PREFIX = "TEDUH-ITEM:";
export const SKU_BARCODE_PREFIX = "T";
export const SKU_DIGITS = 5;

export function skuToBarcode(sku: number): string {
  return `${SKU_BARCODE_PREFIX}${String(sku).padStart(SKU_DIGITS, "0")}`;
}

// Returns the sku encoded in a scanned "T00042"-style code, or null if the
// scanned text doesn't look like one of ours.
export function parseSkuBarcode(value: string): number | null {
  const match = /^T(\d+)$/.exec(value.trim());
  if (!match) return null;
  const sku = parseInt(match[1], 10);
  return Number.isFinite(sku) ? sku : null;
}
