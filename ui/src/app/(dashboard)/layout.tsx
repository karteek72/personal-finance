"use client";

import { usePathname } from "next/navigation";

import { MobileNav } from "@/components/layout/mobile-nav";
import { QueryActivityBar } from "@/components/layout/query-activity-bar";
import { Sidebar } from "@/components/layout/sidebar";
import { SiteFooter } from "@/components/layout/site-footer";
import { TopBar } from "@/components/layout/top-bar";
import { InsightNotificationsSync } from "@/components/notifications/insight-notifications-sync";
import { WrappedNotificationsSync } from "@/components/notifications/wrapped-notifications-sync";
import { CoachAssistant } from "@/components/preview/coach-assistant";
import { WrappedOverlay } from "@/components/preview/wrapped-overlay";
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
      <WrappedNotificationsSync />
      <div className="flex min-h-screen overflow-x-hidden bg-bg">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden pb-20 md:pb-0">
          <TopBar title={title} />
          <main className="relative flex flex-1 flex-col overflow-x-hidden px-4 py-4 md:px-5 md:py-4">
            <QueryActivityBar />
            <div className="animate-fade-in mx-auto flex w-full min-w-0 max-w-5xl flex-1 flex-col xl:max-w-7xl">
              <div className="min-h-0 flex-1">{children}</div>
              <SiteFooter />
            </div>
          </main>
        </div>
        <MobileNav />
        <CoachAssistant />
        <WrappedOverlay />
      </div>
    </AuthGate>
  );
}
