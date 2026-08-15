"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "cafe"
  );
}

export async function signUp(formData: FormData) {
  const businessName = String(formData.get("businessName") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!businessName || !email || !password) {
    redirect("/signup?error=" + encodeURIComponent("Fill in every field"));
  }

  const supabase = await createClient();

  const { error: signUpError } = await supabase.auth.signUp({ email, password });
  if (signUpError) {
    redirect("/signup?error=" + encodeURIComponent(signUpError.message));
  }

  // signUp() also signs the browser in immediately when email confirmation is off
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signInData.user) {
    redirect(
      "/login?notice=" +
        encodeURIComponent("Account created — check your email to confirm, then log in.")
    );
  }

  const baseSlug = slugify(businessName);
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

  const { error: bootstrapError } = await supabase.rpc("bootstrap_business", {
    business_name: businessName,
    business_slug: slug,
  });
  if (bootstrapError) {
    redirect("/signup?error=" + encodeURIComponent(bootstrapError.message));
  }

  redirect("/sell");
}

export async function logIn(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/login?error=" + encodeURIComponent(error.message));
  }

  redirect("/sell");
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
