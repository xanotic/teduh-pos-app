"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";
import type { HappyHourDiscountType } from "@/lib/types";

export async function saveHappyHourSettings(input: {
  isEnabled: boolean;
  discountType: HappyHourDiscountType;
  price: number;
  discountPercent: number;
  startTime: string;
  endTime: string;
  targetDate?: string | null;
  forceActive: boolean;
}) {
  const { supabase, businessId } = await getBusinessContext();

  const { error } = await supabase.from("happy_hour_settings").upsert(
    {
      business_id: businessId,
      is_enabled: input.isEnabled,
      discount_type: input.discountType,
      price: input.price,
      discount_percent: input.discountPercent,
      start_time: input.startTime,
      end_time: input.endTime,
      target_date: input.targetDate ?? null,
      force_active: input.forceActive,
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

export async function toggleHappyHour(isEnabled: boolean) {
  const { supabase, businessId } = await getBusinessContext();

  const { error } = await supabase.from("happy_hour_settings").upsert(
    {
      business_id: businessId,
      is_enabled: isEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" }
  );

  if (error) throw new Error(error.message);

  revalidatePath("/happy-hour");
  revalidatePath("/sell");
}

export async function toggleForceActive(forceActive: boolean) {
  const { supabase, businessId } = await getBusinessContext();

  const { error } = await supabase.from("happy_hour_settings").upsert(
    {
      business_id: businessId,
      force_active: forceActive,
      is_enabled: true, // Auto-enable if forcing active
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" }
  );

  if (error) throw new Error(error.message);

  revalidatePath("/happy-hour");
  revalidatePath("/sell");
}
