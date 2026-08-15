"use server";

import { getBusinessContext } from "@/lib/business";

export async function changeEmail(newEmail: string) {
  const { supabase } = await getBusinessContext();
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw new Error(error.message);
}

export async function changePassword(newPassword: string) {
  const { supabase } = await getBusinessContext();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
