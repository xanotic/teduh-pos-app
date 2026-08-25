"use server";

import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/business";

export async function uploadReceipt(formData: FormData) {
  const { supabase, businessId } = await getBusinessContext();

  const file = formData.get("file");
  const receiptDate = formData.get("date");
  const note = formData.get("note");

  if (!(file instanceof File) || file.size === 0) throw new Error("No image selected.");
  if (!file.type.startsWith("image/")) throw new Error("Receipt must be an image.");
  if (typeof receiptDate !== "string" || !receiptDate) throw new Error("Pick a date for this receipt.");

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const path = `${businessId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(path, file, { contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase.from("receipts").insert({
    business_id: businessId,
    receipt_date: receiptDate,
    note: typeof note === "string" && note.trim() ? note.trim() : null,
    image_path: path,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/receipts");
}

export async function deleteReceipt(id: string, imagePath: string) {
  const { supabase, businessId } = await getBusinessContext();

  const { error } = await supabase.from("receipts").delete().eq("id", id).eq("business_id", businessId);
  if (error) throw new Error(error.message);

  await supabase.storage.from("receipts").remove([imagePath]);

  revalidatePath("/receipts");
}
