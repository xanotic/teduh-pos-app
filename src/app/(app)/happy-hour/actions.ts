"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";
import type { HappyHourDiscountType } from "@/lib/types";

export async function startHappyHour(input: {
  discountType: HappyHourDiscountType;
  price: number;
  discountPercent: number;
  durationHours?: number | null;
}) {
  const { supabase, businessId } = await getBusinessContext();

  const now = new Date();
  const startH = String(now.getHours()).padStart(2, "0");
  const startM = String(now.getMinutes()).padStart(2, "0");
  const startTime = `${startH}:${startM}`;

  let endTime = "23:59";
  if (input.durationHours && input.durationHours > 0) {
    const end = new Date(now.getTime() + input.durationHours * 60 * 60 * 1000);
    const endH = String(end.getHours()).padStart(2, "0");
    const endM = String(end.getMinutes()).padStart(2, "0");
    endTime = `${endH}:${endM}`;
  }

  const { error } = await supabase.from("happy_hour_settings").upsert(
    {
      business_id: businessId,
      is_enabled: true,
      force_active: true,
      discount_type: input.discountType,
      price: input.price,
      discount_percent: input.discountPercent,
      start_time: startTime,
      end_time: endTime,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" }
  );

  if (error) throw new Error(error.message);

  revalidatePath("/happy-hour");
  revalidatePath("/sell");
  revalidatePath("/giveaway");
  revalidatePath("/menu");
}

export async function stopHappyHour() {
  const { supabase, businessId } = await getBusinessContext();

  const { error } = await supabase.from("happy_hour_settings").upsert(
    {
      business_id: businessId,
      is_enabled: false,
      force_active: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" }
  );

  if (error) throw new Error(error.message);

  revalidatePath("/happy-hour");
  revalidatePath("/sell");
  revalidatePath("/giveaway");
  revalidatePath("/menu");
}

export async function cancelHappyHour() {
  return stopHappyHour();
}

export async function saveHappyHourSettings(input: {
  isEnabled: boolean;
  discountType: HappyHourDiscountType;
  price: number;
  discountPercent: number;
  startTime?: string;
  endTime?: string;
  targetDate?: string | null;
  forceActive?: boolean;
}) {
  const { supabase, businessId } = await getBusinessContext();

  const { error } = await supabase.from("happy_hour_settings").upsert(
    {
      business_id: businessId,
      is_enabled: input.isEnabled,
      discount_type: input.discountType,
      price: input.price,
      discount_percent: input.discountPercent,
      start_time: input.startTime ?? "00:00",
      end_time: input.endTime ?? "23:59",
      target_date: input.targetDate ?? null,
      force_active: input.forceActive ?? input.isEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" }
  );

  if (error) throw new Error(error.message);

  revalidatePath("/happy-hour");
  revalidatePath("/sell");
  revalidatePath("/giveaway");
  revalidatePath("/menu");
}
