"use client";

import { useState } from "react";
import Link from "next/link";

import {
  FeaturePanelLoading,
} from "@/components/preview/feature-empty-state";
import { useFeaturePanelGate } from "@/components/preview/use-feature-panel-gate";
import { HoldingsPortfolioSection } from "@/components/preview/panels/holdings-portfolio-section";
import { useAccounts } from "@/hooks/use-accounts";
import { useInvestments } from "@/hooks/use-features";

export function InvestmentsPanel() {
  const [activeTab, setActiveTab] = useState<"portfolio" | "behavioral">("portfolio");
  const gate = useFeaturePanelGate("investments");
  const { data, isLoading } = useAccounts();
  const { data: investments } = useInvestments();

  if (!gate.ready) return gate.node;
  if (isLoading) return <FeaturePanelLoading />;

  function fmt(n: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  }

  const investmentAccounts = (data?.accounts ?? []).filter((a) => a.type === "investment");
  const portfolioValue = investments?.portfolioValue
    ? Number.parseFloat(investments.portfolioValue)
    : investmentAccounts.reduce((s, a) => s + Number.parseFloat(a.balanceCurrent ?? "0"), 0);

  const positions = investments?.positions ?? [];
  const stockAggregates = investments?.stockAggregates ?? [];
  const optionPositions = investments?.optionPositions ?? [];
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
  const hasHoldings = positions.length > 0;

  const behavioralAlerts = investments?.behavioralAlerts ?? [];
  const monthlyActivity = investments?.monthlyActivity ?? null;

  return (
    <div className="space-y-5">
      {/* Portfolio value (real) */}
      <div className="rounded-[var(--radius-lg)] p-5" style={{ background: "var(--gradient-hero)" }}>
        <p className="text-sm font-medium text-white/70">Portfolio value</p>
        <p className="mt-1 text-5xl font-extrabold tracking-tight text-white">
          {isLoading ? "—" : fmt(portfolioValue)}
        </p>
        <p className="mt-2 text-xs text-white/60">
          {investmentAccounts.length > 0
            ? `${investmentAccounts.length} investment account${investmentAccounts.length === 1 ? "" : "s"} connected`
            : "No brokerage connected"}
        </p>
      </div>

      {/* Real investment accounts */}
      {investmentAccounts.length > 0 ? (
        <div className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Accounts</p>
          {investmentAccounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-text">{a.name}</p>
                <p className="text-xs text-text-muted">{a.institutionName}{a.mask ? ` ····${a.mask}` : ""}</p>
              </div>
              <p className="text-sm font-bold text-text">{fmt(Number.parseFloat(a.balanceCurrent ?? "0"))}</p>
            </div>
          ))}
        </div>
      ) : (
        !isLoading && (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-surface p-6 text-center">
            <p className="text-sm font-semibold text-text">No investment accounts connected</p>
            <p className="mt-1 text-xs text-text-muted">Link a brokerage to track your portfolio value here.</p>
            <Link
              href="/accounts"
              className="mt-3 inline-block rounded-[var(--radius-md)] px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "var(--gradient-hero)" }}
            >
              Connect a brokerage
            </Link>
          </div>
        )
      )}

      {/* Holdings & behavioral analysis */}
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
            <HoldingsPortfolioSection
              positions={positions}
              stockAggregates={stockAggregates}
              optionPositions={optionPositions}
              portfolioBreakdown={portfolioBreakdown}
              accountOptions={investmentAccounts.map((a) => ({
                id: a.id,
                name: a.name,
                mask: a.mask,
              }))}
            />
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
                <p className={`text-sm font-semibold ${
                  alert.type === "warning" ? "text-warning" : alert.type === "positive" ? "text-primary" : "text-text"
                }`}>
                  {alert.title}
                </p>
                <p className="mt-1 text-xs text-text-muted leading-relaxed">{alert.desc}</p>
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
