"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";
import type { PaymentType } from "@/lib/types";

export async function addShelfLifeEntry(input: {
  item: string;
  expiresAt: string;
  notes: string;
  paymentType: PaymentType;
  qty: number;
  cost: number | null;
}) {
  const { supabase, businessId } = await getBusinessContext();
  const entryQty = input.qty || 1;

  const { error } = await supabase.from("shelf_life").insert({
    business_id: businessId,
    item: input.item,
    expires_at: input.expiresAt,
    notes: input.notes || null,
    payment_type: input.paymentType,
    qty: entryQty,
    initial_qty: entryQty,
    cost: input.cost,
  });
  if (error) throw new Error(error.message);

  // Auto-increment stock on the Menu page for matching menu item if stock tracking is enabled (stock != null)
  const { data: menuItem } = await supabase
    .from("menu_items")
    .select("id, stock")
    .eq("business_id", businessId)
    .ilike("name", input.item.trim())
    .maybeSingle();

  if (menuItem && menuItem.stock != null) {
    await supabase
      .from("menu_items")
      .update({ stock: menuItem.stock + entryQty })
      .eq("id", menuItem.id);
  }

  revalidatePath("/shelf-life");
  revalidatePath("/menu");
  revalidatePath("/sell");
}

export async function deleteShelfLifeEntry(id: string) {
  const { supabase, businessId } = await getBusinessContext();

  // Fetch the entry details before deleting to adjust stock
  const { data: entry } = await supabase
    .from("shelf_life")
    .select("item, qty")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("shelf_life").delete().eq("id", id);
  if (error) throw new Error(error.message);

  if (entry) {
    const { data: menuItem } = await supabase
      .from("menu_items")
      .select("id, stock")
      .eq("business_id", businessId)
      .ilike("name", entry.item.trim())
      .maybeSingle();

    if (menuItem && menuItem.stock != null) {
      const updatedStock = Math.max(0, menuItem.stock - (entry.qty || 1));
      await supabase
        .from("menu_items")
        .update({ stock: updatedStock })
        .eq("id", menuItem.id);
    }
  }

  revalidatePath("/shelf-life");
  revalidatePath("/menu");
  revalidatePath("/sell");
}
