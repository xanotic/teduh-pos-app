"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";

export async function addStaff(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Enter a staff name.");

  const { supabase, businessId } = await getBusinessContext();

  const { data, error } = await supabase
    .from("staff")
    .insert({ business_id: businessId, name: trimmed })
    .select("id, business_id, name, qr_url, created_at")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/staff-payout");
  return data;
}

export async function deleteStaff(id: string) {
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase.from("staff").delete().eq("id", id).eq("business_id", businessId);
  if (error) throw new Error(error.message);
  revalidatePath("/staff-payout");
}

export async function uploadStaffQr(staffId: string, formData: FormData) {
  const { supabase, businessId } = await getBusinessContext();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("No image selected.");
  if (!file.type.startsWith("image/")) throw new Error("QR file must be an image.");

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
  const path = `${businessId}/${staffId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("staff-qr")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from("staff-qr").getPublicUrl(path);

  const { error } = await supabase
    .from("staff")
    .update({ qr_url: publicUrlData.publicUrl })
    .eq("id", staffId)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/staff-payout");
}

export async function createStaffPayout(input: { staffId: string | null; amount: number; note?: string }) {
  if (!(input.amount > 0)) throw new Error("Enter an amount greater than 0.");

  const { supabase, businessId } = await getBusinessContext();

  const { error } = await supabase.from("staff_payouts").insert({
    business_id: businessId,
    staff_id: input.staffId,
    amount: input.amount,
    note: input.note?.trim() || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/staff-payout");
}

export async function markStaffPayoutPaid(id: string, paid: boolean) {
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase
    .from("staff_payouts")
    .update({ paid, paid_at: paid ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);
  revalidatePath("/staff-payout");
}

export async function deleteStaffPayout(id: string) {
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase.from("staff_payouts").delete().eq("id", id).eq("business_id", businessId);
  if (error) throw new Error(error.message);
  revalidatePath("/staff-payout");
}
