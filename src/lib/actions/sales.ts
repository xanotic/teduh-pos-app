"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";
import type { CartLine, PaymentMethod } from "@/lib/types";

/**
 * Shared by both Sell (Cash/QR Pay) and Giveaway (Giveaway payment method).
 * A giveaway is priced at full sell price, same as a normal sale — the owner
 * is paying the till themselves, so revenue/history/analytics all treat it
 * like any other transaction, just tagged by payment method.
 */
export async function finalizeSale(paymentMethod: PaymentMethod, lines: CartLine[], note?: string) {
  if (!lines.length) throw new Error("Cart is empty");

  const { supabase, businessId } = await getBusinessContext();
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);

  const { data: txn, error: txnError } = await supabase
    .from("transactions")
    .insert({ business_id: businessId, payment_method: paymentMethod, note: note || null, total })
    .select("id")
    .single();
  if (txnError || !txn) throw new Error(txnError?.message ?? "Could not create transaction");

  const { error: itemsError } = await supabase.from("transaction_items").insert(
    lines.map((l) => ({
      transaction_id: txn.id,
      name: l.name,
      category: l.category,
      price: l.price,
      cost: l.cost,
      qty: l.qty,
    }))
  );
  if (itemsError) throw new Error(itemsError.message);

  await Promise.all(lines.map((l) => supabase.rpc("adjust_menu_stock", { p_name: l.name, p_delta: -l.qty })));

  revalidatePath("/sell");
  revalidatePath("/giveaway");
  revalidatePath("/history");
  revalidatePath("/analytics");
  revalidatePath("/menu");
}

export async function voidTransaction(id: string) {
  const { supabase } = await getBusinessContext();

  const { data: txn } = await supabase
    .from("transactions")
    .select("transaction_items(name, qty)")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);

  if (txn) {
    await Promise.all(
      (txn.transaction_items as { name: string; qty: number }[]).map((l) =>
        supabase.rpc("adjust_menu_stock", { p_name: l.name, p_delta: l.qty })
      )
    );
  }

  revalidatePath("/history");
  revalidatePath("/giveaway");
  revalidatePath("/analytics");
  revalidatePath("/menu");
}

export async function updateTransaction(
  id: string,
  paymentMethod: PaymentMethod,
  lines: { name: string; category: string; price: number; cost: number | null; qty: number }[]
) {
  if (!lines.length) throw new Error("A transaction needs at least one item — void it instead");

  const { supabase } = await getBusinessContext();
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);

  const { data: existing } = await supabase
    .from("transaction_items")
    .select("name, qty")
    .eq("transaction_id", id);

  const { error: updateError } = await supabase
    .from("transactions")
    .update({ payment_method: paymentMethod, total })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);

  const { error: deleteError } = await supabase.from("transaction_items").delete().eq("transaction_id", id);
  if (deleteError) throw new Error(deleteError.message);

  const { error: insertError } = await supabase.from("transaction_items").insert(
    lines.map((l) => ({ transaction_id: id, ...l }))
  );
  if (insertError) throw new Error(insertError.message);

  // Restore stock for the old line-up, then deduct for the new one — net effect
  // is only the difference actually gets applied.
  await Promise.all([
    ...(existing ?? []).map((l) => supabase.rpc("adjust_menu_stock", { p_name: l.name, p_delta: l.qty })),
    ...lines.map((l) => supabase.rpc("adjust_menu_stock", { p_name: l.name, p_delta: -l.qty })),
  ]);

  revalidatePath("/history");
  revalidatePath("/analytics");
  revalidatePath("/menu");
}
