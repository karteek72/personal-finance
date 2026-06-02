"use client";

import { usePathname } from "next/navigation";

import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

const PAGE_TITLES: Record<string, string> = {
  "/": "Home",
  "/flow": "Flow",
  "/categories": "Spend",
  "/transactions": "Activity",
  "/accounts": "Wallet",
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "SpendFlow";

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-24 md:pb-6">
        <TopBar title={title} />
        <main className="flex-1 px-4 py-4 md:px-6 md:py-5">
          <div className="animate-fade-in mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
