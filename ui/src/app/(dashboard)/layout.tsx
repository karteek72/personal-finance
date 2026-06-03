"use client";

import { usePathname } from "next/navigation";

import { MobileNav } from "@/components/layout/mobile-nav";
import { QueryActivityBar } from "@/components/layout/query-activity-bar";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { InsightNotificationsSync } from "@/components/notifications/insight-notifications-sync";
import { AuthGate } from "@/providers/auth-provider";

const PAGE_TITLES: Record<string, string> = {
  "/": "Home",
  "/flow": "Cash Flow",
  "/categories": "Spend",
  "/transactions": "Activity",
  "/accounts": "Accounts",
  "/debt": "Debt",
  "/family": "Family",
  "/budgets": "Budgets & Goals",
  "/wellness": "Wellness Score",
  "/subscriptions": "Subscriptions",
  "/coach": "AI Coach",
  "/net-worth": "Net Worth",
  "/inflation": "Inflation Intel",
  "/behavioral": "Behavioral",
  "/investments": "Investments",
  "/wrapped": "Wrapped",
  "/calendar": "Money Calendar",
  "/resilience": "Financial Immune System",
  "/fire": "FIRE Calculator",
  "/time-machine": "Financial Time Machine",
  "/forecast": "Financial Forecast",
  "/dna": "Spending DNA",
  "/why": "Why Tagger",
  "/leaks": "Money Leaks",
  "/merchants": "Merchants & Income",
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
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
          <TopBar title={title} />
          <main className="relative flex-1 px-4 py-4 md:px-5 md:py-4">
            <QueryActivityBar />
            <div className="animate-fade-in mx-auto w-full max-w-5xl xl:max-w-7xl">
              {children}
            </div>
          </main>
        </div>
        <MobileNav />
      </div>
    </AuthGate>
  );
}
