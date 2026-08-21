import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Malaysia is UTC+8 with no DST — same explicit-offset approach used across History/Analytics/Consignment.
const MY_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Batches whose expiry date has passed are spoiled stock — no cron job exists
 * for this app, so instead this runs once per request (guarded by
 * stock_deducted so it only fires once per batch) right after we know the
 * business, which every page/action already resolves via getBusinessContext.
 */
async function sweepExpiredShelfLife(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string
) {
  const todayMY = new Date(Date.now() + MY_OFFSET_MS).toISOString().slice(0, 10);

  const { data: expired } = await supabase
    .from("shelf_life")
    .select("id, item, qty")
    .eq("business_id", businessId)
    .eq("stock_deducted", false)
    .lt("expires_at", todayMY);

  if (!expired || expired.length === 0) return;

  await Promise.all(
    expired.map(async (e) => {
      if (e.qty > 0) {
        await supabase.rpc("adjust_menu_stock", { p_name: e.item, p_delta: -e.qty });
      }
      await supabase.from("shelf_life").update({ stock_deducted: true }).eq("id", e.id);
    })
  );
}

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
  const businessId = profile.business_id as string;

  await sweepExpiredShelfLife(supabase, businessId);

  return { supabase, businessId, businessName, userEmail: user.email };
});
