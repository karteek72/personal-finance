"use client";

import { usePathname } from "next/navigation";

import { MobileNav } from "@/components/layout/mobile-nav";
import { QueryActivityBar } from "@/components/layout/query-activity-bar";
import { Sidebar } from "@/components/layout/sidebar";
import { SiteFooter } from "@/components/layout/site-footer";
import { TopBar } from "@/components/layout/top-bar";
import { InsightNotificationsSync } from "@/components/notifications/insight-notifications-sync";
import { CoachAssistant } from "@/components/preview/coach-assistant";
import { AuthGate } from "@/providers/auth-provider";

const PAGE_TITLES: Record<string, string> = {
  "/": "Home",
  "/flow": "Cash Flow",
  "/categories": "Spend",
  "/transactions": "Activity",
  "/accounts": "Accounts & Debt",
  "/debt": "Accounts & Debt",
  "/family": "Family",
  "/profile": "Profile",
  "/plan": "Plan",
  "/wealth": "Wealth",
  "/understand": "Insights",
  "/protect": "Protect",
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "SpendFlow";

  return (
    <AuthGate>
      <InsightNotificationsSync />
      <div className="flex min-h-screen overflow-x-hidden bg-bg">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden pb-20 md:pb-0">
          <TopBar title={title} />
          <main className="relative flex-1 overflow-x-hidden px-4 py-4 md:px-5 md:py-4">
            <QueryActivityBar />
            <div className="animate-fade-in mx-auto w-full min-w-0 max-w-5xl xl:max-w-7xl">
              {children}
              <SiteFooter />
            </div>
          </main>
        </div>
        <MobileNav />
        <CoachAssistant />
      </div>
    </AuthGate>
  );
}
