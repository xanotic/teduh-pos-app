import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teduh POS",
  description: "Point of sale, analytics, and inventory for supplier-based dessert cafes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
