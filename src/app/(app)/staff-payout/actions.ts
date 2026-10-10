"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";
import type { StaffRole } from "@/lib/types";

export async function addStaff(name: string, hourlyRate?: number | null, role?: StaffRole) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Enter a staff name.");

  const { supabase, businessId } = await getBusinessContext();

  const { data, error } = await supabase
    .from("staff")
    .insert({ business_id: businessId, name: trimmed, hourly_rate: hourlyRate ?? null, role: role ?? "staff" })
    .select("id, business_id, name, qr_url, hourly_rate, role, created_at")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/staff-payout");
  return data;
}

export async function updateStaffRate(staffId: string, hourlyRate: number | null) {
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase
    .from("staff")
    .update({ hourly_rate: hourlyRate })
    .eq("id", staffId)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);
  revalidatePath("/staff-payout");
}

export async function updateStaffRole(staffId: string, role: StaffRole) {
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase
    .from("staff")
    .update({ role })
    .eq("id", staffId)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);
  revalidatePath("/staff-payout");
}

export async function deleteStaff(id: string) {
  const { supabase, businessId } = await getBusinessContext();

  // Snapshot the name onto every payout still linked to this staff member
  // before the row (and its name) is gone for good — staff_payouts.staff_id
  // is "on delete set null", so without this their payout history would show
  // "No staff selected" from here on.
  const { data: staffRow } = await supabase
    .from("staff")
    .select("name")
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle();
  if (staffRow) {
    await supabase
      .from("staff_payouts")
      .update({ staff_name: staffRow.name })
      .eq("staff_id", id)
      .eq("business_id", businessId)
      .is("staff_name", null);
  }

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

export async function createStaffPayout(input: {
  staffId: string | null;
  amount: number;
  note?: string;
  hours?: number | null;
  hourlyRate?: number | null;
}) {
  if (!(input.amount > 0)) throw new Error("Enter an amount greater than 0.");

  const { supabase, businessId } = await getBusinessContext();

  // Snapshot the staff name at the time of the payout, not just the id — so
  // the name survives even if the staff member is later deleted.
  let staffName: string | null = null;
  if (input.staffId) {
    const { data } = await supabase.from("staff").select("name").eq("id", input.staffId).maybeSingle();
    staffName = data?.name ?? null;
  }

  const { error } = await supabase.from("staff_payouts").insert({
    business_id: businessId,
    staff_id: input.staffId,
    staff_name: staffName,
    amount: input.amount,
    hours: input.hours ?? null,
    hourly_rate: input.hourlyRate ?? null,
    note: input.note?.trim() || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/staff-payout");
}

// For payouts from before this fix (staff already deleted, name lost for
// good) — lets the owner manually type the name back in from memory.
export async function updateStaffPayoutName(id: string, staffName: string) {
  const trimmed = staffName.trim();
  if (!trimmed) throw new Error("Enter a name.");
  const { supabase, businessId } = await getBusinessContext();
  const { error } = await supabase
    .from("staff_payouts")
    .update({ staff_name: trimmed })
    .eq("id", id)
    .eq("business_id", businessId);
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
