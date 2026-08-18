import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Every page/action in the (app) group calls this first. It resolves the
 * signed-in user's business_id server-side — callers never pass business_id
 * themselves, so a compromised client can't forge access to another tenant.
 * (RLS is still the real backstop; this just keeps queries scoped correctly.)
 *
 * Wrapped in React's cache() so the layout and the page it wraps share one
 * result instead of each re-checking auth + re-querying the profile —
 * without this, a single navigation was doing it twice.
 */
export const getBusinessContext = cache(async () => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id, businesses(name)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    redirect("/signup?error=" + encodeURIComponent("No cafe workspace found for this account. Please sign up to create a workspace."));
  }

  const businessName = (profile.businesses as unknown as { name: string } | null)?.name ?? "Cafe";

  return { supabase, businessId: profile.business_id as string, businessName, userEmail: user.email };
});
