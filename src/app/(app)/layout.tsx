import { getBusinessContext } from "@/lib/business";
import { Nav } from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { businessName } = await getBusinessContext();

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <Nav businessName={businessName} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
