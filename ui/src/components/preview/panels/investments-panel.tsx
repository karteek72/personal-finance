"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  FeaturePanelLoading,
} from "@/components/preview/feature-empty-state";
import { useFeaturePanelGate } from "@/components/preview/use-feature-panel-gate";
import { HoldingsPortfolioSection } from "@/components/preview/panels/holdings-portfolio-section";
import { InvestmentsKpiSection } from "@/components/preview/panels/investments-kpi-section";
import { TrimLosersCard } from "@/components/preview/panels/trim-losers-card";
import { useInvestments } from "@/hooks/use-features";

function InvestmentsPanelContent() {
  const [activeTab, setActiveTab] = useState<"portfolio" | "behavioral">("portfolio");
  const gate = useFeaturePanelGate("investments");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const accountId = searchParams.get("accountId") ?? "";

  const { data: investments, isLoading } = useInvestments({
    accountId: accountId || undefined,
    page: 1,
    pageSize: 1,
    sort: "value",
    dir: "desc",
  });

  const setAccountId = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("accountId", next);
      else params.delete("accountId");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  if (!gate.ready) return gate.node;
  if (isLoading && !investments) return <FeaturePanelLoading />;

  function fmt(n: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  }

  const investmentAccounts = investments?.accounts ?? [];
  const portfolioBreakdown = investments?.portfolioBreakdown ?? {
    stocksValue: "0",
    optionsValue: "0",
    stocksSharePercent: 0,
    optionsSharePercent: 0,
    stockPositionCount: 0,
    optionPositionCount: 0,
    totalPositionCount: 0,
    otherValue: "0",
  };
  const hasHoldings = portfolioBreakdown.totalPositionCount > 0;
  const behavioralAlerts = investments?.behavioralAlerts ?? [];
  const monthlyActivity = investments?.monthlyActivity ?? null;

  return (
    <div className="space-y-5">
      {investmentAccounts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Account
          </span>
          <button
            type="button"
            onClick={() => setAccountId("")}
            className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold ${
              !accountId
                ? "bg-primary text-text-inverse"
                : "bg-surface text-text-muted card-shadow"
            }`}
          >
            All accounts
          </button>
          {investmentAccounts.map((a) => (
            <button
              key={a.accountId}
              type="button"
              onClick={() => setAccountId(a.accountId)}
              className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold ${
                accountId === a.accountId
                  ? "bg-primary text-text-inverse"
                  : "bg-surface text-text-muted card-shadow"
              }`}
            >
              {a.name} ({fmt(Number.parseFloat(a.value))})
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-surface p-6 text-center">
          <p className="text-sm font-semibold text-text">No investment accounts connected</p>
          <p className="mt-1 text-xs text-text-muted">
            Link a brokerage to track your portfolio value here.
          </p>
          <Link
            href="/accounts"
            className="mt-3 inline-block rounded-[var(--radius-md)] px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "var(--gradient-hero)" }}
          >
            Connect a brokerage
          </Link>
        </div>
      )}

      {investments ? <InvestmentsKpiSection data={investments} /> : null}

      <div className="rounded-[var(--radius-lg)] border border-border bg-surface-raised/40 p-4">
        <p className="mb-3 text-sm font-bold text-text">Holdings &amp; behavioral insights</p>
        <div className="mb-3 flex gap-1 rounded-[var(--radius-sm)] bg-surface-raised p-1">
          {(["portfolio", "behavioral"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-[var(--radius-sm)] py-1.5 text-sm font-semibold transition-all ${
                activeTab === tab ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"
              }`}
            >
              {tab === "portfolio" ? "Holdings" : "Behavioral Patterns"}
            </button>
          ))}
        </div>

        {activeTab === "portfolio" && (
          hasHoldings ? (
            <div className="space-y-4">
              <HoldingsPortfolioSection
                portfolioBreakdown={portfolioBreakdown}
                accountId={accountId || undefined}
              />
              {investments?.pruneLosers ? (
                <TrimLosersCard pruneLosers={investments.pruneLosers} />
              ) : null}
            </div>
          ) : (
            <p className="px-1 py-4 text-center text-sm text-text-muted">
              {investmentAccounts.length > 0
                ? "No positions stored yet. Sync your brokerage from Accounts — holdings appear after sync completes."
                : "No holdings synced yet. Connect a brokerage and run sync to see positions here."}
            </p>
          )
        )}

        {activeTab === "behavioral" && (
          <div className="space-y-3">
            {behavioralAlerts.length === 0 && !monthlyActivity ? (
              <p className="px-1 py-4 text-center text-sm text-text-muted">
                No behavioral insights yet. Sync your brokerage to see portfolio health and trading-style patterns.
              </p>
            ) : null}
            {behavioralAlerts.map((alert, i) => (
              <div
                key={i}
                className={`rounded-[var(--radius-md)] border p-4 ${
                  alert.type === "warning"
                    ? "border-warning/30 bg-warning/5"
                    : alert.type === "positive"
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-surface"
                }`}
              >
                <p
                  className={`text-sm font-semibold ${
                    alert.type === "warning"
                      ? "text-warning"
                      : alert.type === "positive"
                        ? "text-primary"
                        : "text-text"
                  }`}
                >
                  {alert.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">{alert.desc}</p>
              </div>
            ))}

            {monthlyActivity ? (
              <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
                <p className="mb-1 text-sm font-semibold text-text">Cash deployed this month</p>
                <p className="mb-3 text-[10px] text-text-muted">
                  Transfers in plus new purchases (options at contract cost, not inflated trade notional).
                </p>
                <p className="text-2xl font-extrabold text-success">
                  {fmt(Number.parseFloat(monthlyActivity.totalDeployed))}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-[var(--radius-sm)] bg-surface-raised p-3">
                    <p className="text-xs text-text-muted">Contributions</p>
                    <p className="text-sm font-bold text-text">
                      {fmt(Number.parseFloat(monthlyActivity.cashContributions))}
                    </p>
                  </div>
                  <div className="rounded-[var(--radius-sm)] bg-surface-raised p-3">
                    <p className="text-xs text-text-muted">New buys</p>
                    <p className="text-sm font-bold text-text">
                      {fmt(Number.parseFloat(monthlyActivity.purchaseDeployments))}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function InvestmentsPanel() {
  return (
    <Suspense fallback={<FeaturePanelLoading />}>
      <InvestmentsPanelContent />
    </Suspense>
  );
}
