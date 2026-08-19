import { getBusinessContext } from "@/lib/business";
import { AccountClient } from "./AccountClient";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { supabase, businessId, userEmail, businessName } = await getBusinessContext();

  const { data: business } = await supabase
    .from("businesses")
    .select("boss_whatsapp")
    .eq("id", businessId)
    .single();

  return (
    <AccountClient
      currentEmail={userEmail ?? ""}
      businessName={businessName}
      bossWhatsapp={business?.boss_whatsapp ?? ""}
    />
  );
}
