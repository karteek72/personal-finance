"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FeaturePanelLoading } from "@/components/preview/feature-empty-state";
import { useFeaturePanelGate } from "@/components/preview/use-feature-panel-gate";
import { HoldingsTable } from "@/components/preview/panels/holdings-portfolio-section";
import { InvestmentsKpiSection } from "@/components/preview/panels/investments-kpi-section";
import { TrimLosersCard } from "@/components/preview/panels/trim-losers-card";
import { useInvestments } from "@/hooks/use-features";

type InvestmentsTab = "stocks" | "options" | "behavioral";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function TabButton({
  active,
  onClick,
  label,
  meta,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  meta?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-1 pb-2 text-sm font-semibold transition-colors ${
        active
          ? "border-primary text-text"
          : "border-transparent text-text-muted hover:text-text"
      }`}
    >
      {label}
      {meta ? (
        <span className="ml-1.5 text-xs font-normal text-text-muted">{meta}</span>
      ) : null}
    </button>
  );
}

function InvestmentsPanelContent() {
  const [activeTab, setActiveTab] = useState<InvestmentsTab>("stocks");
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
  const linkedAccountBalance = investmentAccounts.reduce(
    (sum, account) => sum + Number.parseFloat(account.value),
    0,
  );
  const needsHoldingsResync =
    investmentAccounts.length > 0 && !hasHoldings && linkedAccountBalance > 0;
  const behavioralAlerts = investments?.behavioralAlerts ?? [];
  const monthlyActivity = investments?.monthlyActivity ?? null;

  const stocksMeta = hasHoldings
    ? `${fmt(Number.parseFloat(portfolioBreakdown.stocksValue))} · ${portfolioBreakdown.stockPositionCount}`
    : undefined;
  const optionsMeta = hasHoldings
    ? `${fmt(Number.parseFloat(portfolioBreakdown.optionsValue))} · ${portfolioBreakdown.optionPositionCount}`
    : undefined;

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

      <section className="space-y-3">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-1 border-b border-border">
          <TabButton
            active={activeTab === "stocks"}
            onClick={() => setActiveTab("stocks")}
            label="Stocks & ETFs"
            meta={stocksMeta}
          />
          <TabButton
            active={activeTab === "options"}
            onClick={() => setActiveTab("options")}
            label="Options"
            meta={optionsMeta}
          />
          <TabButton
            active={activeTab === "behavioral"}
            onClick={() => setActiveTab("behavioral")}
            label="Behavioral"
            meta={
              behavioralAlerts.length > 0
                ? `${behavioralAlerts.length} alert${behavioralAlerts.length === 1 ? "" : "s"}`
                : undefined
            }
          />
        </div>

        {activeTab === "stocks" &&
          (hasHoldings ? (
            <HoldingsTable
              kind="stocks"
              queryPrefix="holdingsStocks"
              accountId={accountId || undefined}
            />
          ) : (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-surface px-4 py-6 text-center">
              <p className="text-sm font-semibold text-text">
                {needsHoldingsResync
                  ? "Account balances synced, but position details are missing"
                  : "No positions stored yet"}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {needsHoldingsResync
                  ? "This usually happens after removing another account. Re-sync your brokerages from Accounts to reload stocks, ETFs, and options."
                  : investmentAccounts.length > 0
                    ? "Sync your brokerage from Accounts to load holdings."
                    : "Connect a brokerage and run sync to see holdings."}
              </p>
              {investmentAccounts.length > 0 ? (
                <Link
                  href="/accounts"
                  className="mt-3 inline-block rounded-[var(--radius-md)] px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: "var(--gradient-hero)" }}
                >
                  Sync brokerages
                </Link>
              ) : null}
            </div>
          ))}

        {activeTab === "options" &&
          (hasHoldings && portfolioBreakdown.optionPositionCount > 0 ? (
            <HoldingsTable
              kind="options"
              queryPrefix="holdingsOptions"
              accountId={accountId || undefined}
            />
          ) : (
            <p className="py-6 text-center text-sm text-text-muted">
              {hasHoldings
                ? "No options in this portfolio."
                : "No holdings synced yet."}
            </p>
          ))}

        {activeTab === "behavioral" && (
          <div className="space-y-3 pt-1">
            {behavioralAlerts.length === 0 && !monthlyActivity ? (
              <p className="py-4 text-center text-sm text-text-muted">
                No behavioral insights yet. Sync your brokerage to see portfolio health patterns.
              </p>
            ) : null}

            {behavioralAlerts.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {behavioralAlerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`rounded-[var(--radius-md)] border px-3 py-2.5 ${
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
                    <p className="mt-0.5 text-xs leading-snug text-text-muted">{alert.desc}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {monthlyActivity ? (
              <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                    Deployed this month
                  </p>
                  <p className="text-lg font-extrabold text-success">
                    {fmt(Number.parseFloat(monthlyActivity.totalDeployed))}
                  </p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <p className="text-[10px] text-text-muted">Contributions</p>
                  <p className="text-sm font-bold text-text">
                    {fmt(Number.parseFloat(monthlyActivity.cashContributions))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted">New buys</p>
                  <p className="text-sm font-bold text-text">
                    {fmt(Number.parseFloat(monthlyActivity.purchaseDeployments))}
                  </p>
                </div>
              </div>
            ) : null}

            {investments?.pruneLosers ? (
              <TrimLosersCard pruneLosers={investments.pruneLosers} />
            ) : null}
          </div>
        )}
      </section>
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
