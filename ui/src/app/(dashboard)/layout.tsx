"use client";

import { usePathname } from "next/navigation";

import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/flow": "Money Flow",
  "/categories": "Categories",
  "/transactions": "Transactions",
  "/accounts": "Accounts",
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
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <TopBar title={title} />
        <main className="flex-1 px-4 py-4 md:px-5 md:py-5">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
