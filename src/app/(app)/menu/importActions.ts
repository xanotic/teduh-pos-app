"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";

interface LegacyMenuItem {
  name: string;
  category: string;
  price: number;
  cost: number | null;
}

interface LegacyTxnItem {
  name: string;
  category?: string;
  price: number;
  cost: number | null;
  qty: number;
}

interface LegacyTxn {
  ts: number;
  paymentMethod?: string | null;
  total: number;
  note?: string;
  items: LegacyTxnItem[];
}

interface LegacyBackup {
  menu: LegacyMenuItem[];
  transactions: LegacyTxn[];
}

const VALID_PAYMENTS = new Set(["Cash", "QR Pay", "Giveaway"]);

/**
 * One-time migration from the old single-file localStorage POS's
 * "Back Up to Google Drive" JSON snapshot. Menu items are upserted by
 * name (updates price/cost if the item already exists here); every
 * transaction in the snapshot is inserted fresh, so don't run this twice
 * with the same file or sales will be duplicated.
 */
export async function importLegacyBackup(raw: string) {
  const { supabase, businessId } = await getBusinessContext();

  let data: LegacyBackup;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("That doesn't look like valid backup JSON.");
  }
  if (!Array.isArray(data.menu) || !Array.isArray(data.transactions)) {
    throw new Error("That JSON doesn't have the expected menu/transactions shape.");
  }

  const { data: existing } = await supabase
    .from("menu_items")
    .select("id, name")
    .eq("business_id", businessId);
  const existingByName = new Map((existing ?? []).map((m) => [m.name, m.id]));

  let itemsAdded = 0;
  let itemsUpdated = 0;

  for (const item of data.menu) {
    if (!item.name || !item.category) continue;
    const existingId = existingByName.get(item.name);
    if (existingId) {
      await supabase.from("menu_items").update({ price: item.price, cost: item.cost }).eq("id", existingId);
      itemsUpdated++;
    } else {
      await supabase.from("menu_items").insert({
        business_id: businessId,
        name: item.name,
        category: item.category,
        price: item.price,
        cost: item.cost,
      });
      itemsAdded++;
    }
  }

  let txnsImported = 0;
  for (const t of data.transactions) {
    if (!t.items?.length) continue;
    const paymentMethod = VALID_PAYMENTS.has(t.paymentMethod ?? "") ? t.paymentMethod! : "Cash";

    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .insert({
        business_id: businessId,
        ts: new Date(t.ts).toISOString(),
        payment_method: paymentMethod,
        note: t.note || null,
        total: t.total,
      })
      .select("id")
      .single();
    if (txnError || !txn) continue;

    await supabase.from("transaction_items").insert(
      t.items.map((i) => ({
        transaction_id: txn.id,
        name: i.name,
        category: i.category || "Other",
        price: i.price,
        cost: i.cost,
        qty: i.qty,
      }))
    );
    txnsImported++;
  }

  revalidatePath("/menu");
  revalidatePath("/sell");
  revalidatePath("/history");
  revalidatePath("/analytics");

  return { itemsAdded, itemsUpdated, txnsImported };
}
