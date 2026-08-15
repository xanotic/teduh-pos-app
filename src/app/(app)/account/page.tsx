import { getBusinessContext } from "@/lib/business";
import { AccountClient } from "./AccountClient";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { userEmail, businessName } = await getBusinessContext();

  return <AccountClient currentEmail={userEmail ?? ""} businessName={businessName} />;
}
