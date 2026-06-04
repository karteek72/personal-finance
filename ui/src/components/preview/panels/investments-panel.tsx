"use client";

import { useState } from "react";
import Link from "next/link";

import {
  FeatureEmptyState,
  FeaturePanelLoading,
} from "@/components/preview/feature-empty-state";
import { useFeaturePanelGate } from "@/components/preview/use-feature-panel-gate";
import { useAccounts } from "@/hooks/use-accounts";
import { useInvestments } from "@/hooks/use-features";

interface Holding {
  ticker: string;
  name: string;
  shares: number;
  costBasis: number;
  currentPrice: number;
  assetType: string;
  sector: string | null;
  underlyingTicker?: string | null;
  optionType?: string | null;
  expirationLabel?: string | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtPremium(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function pct(cost: number, current: number) {
  if (cost <= 0) return "0.0";
  return (((current - cost) / cost) * 100).toFixed(1);
}

function isOption(assetType: string) {
  return assetType === "option";
}

function assetTypeLabel(assetType: string): string {
  const labels: Record<string, string> = {
    equity: "Stock",
    etf: "ETF",
    mutual_fund: "Mutual fund",
    bond: "Bond",
    crypto: "Crypto",
    option: "Option",
  };
  return labels[assetType] ?? assetType;
}

function holdingBadge(h: Holding): string {
  if (isOption(h.assetType)) {
    return (h.underlyingTicker ?? h.ticker.split(/\s+/)[0] ?? h.ticker).slice(0, 4);
  }
  return h.ticker.slice(0, 4);
}

export function InvestmentsPanel() {
  const [activeTab, setActiveTab] = useState<"portfolio" | "behavioral">("portfolio");
  const gate = useFeaturePanelGate("investments");
  const { data, isLoading } = useAccounts();
  const { data: investments } = useInvestments();

  if (!gate.ready) return gate.node;
  if (isLoading) return <FeaturePanelLoading />;

  const investmentAccounts = (data?.accounts ?? []).filter((a) => a.type === "investment");
  const portfolioValue = investments?.portfolioValue
    ? Number.parseFloat(investments.portfolioValue)
    : investmentAccounts.reduce((s, a) => s + Number.parseFloat(a.balanceCurrent ?? "0"), 0);

  const holdings: Holding[] = (investments?.holdings ?? []).map((h) => ({
    ticker: h.ticker,
    name: h.name,
    shares: h.quantity,
    costBasis: Number.parseFloat(h.costBasis),
    currentPrice: Number.parseFloat(h.currentPrice),
    assetType: h.assetType,
    sector: h.sector,
    underlyingTicker: h.underlyingTicker,
    optionType: h.optionType,
    expirationLabel: h.expirationLabel,
  }));

  const behavioralAlerts = investments?.behavioralAlerts ?? [];
  const monthlyComparison = investments?.monthlyComparison ?? null;

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
          <div className="space-y-2">
            {holdings.length === 0 ? (
              <p className="px-1 py-4 text-center text-sm text-text-muted">
                {investmentAccounts.length > 0
                  ? "No positions stored yet. Sync your brokerage from Accounts — holdings appear after sync completes."
                  : "No holdings synced yet. Connect a brokerage and run sync to see positions here."}
              </p>
            ) : null}
            {holdings.map((h) => {
              const value = h.shares * h.currentPrice;
              const gain = h.currentPrice - h.costBasis;
              const gainP = pct(h.costBasis, h.currentPrice);
              const positive = gain >= 0;
              const option = isOption(h.assetType);
              return (
                <div
                  key={`${h.ticker}-${h.name}`}
                  className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-3.5"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-[var(--radius-sm)] font-bold text-text ${
                      option ? "bg-warning/15 ring-1 ring-warning/30" : "bg-surface-raised"
                    }`}
                  >
                    <span className="text-[10px] leading-none">{holdingBadge(h)}</span>
                    {option ? (
                      <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide text-warning">
                        opt
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-text">{h.name}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          option
                            ? "bg-warning/10 text-warning"
                            : "bg-surface-raised text-text-muted"
                        }`}
                      >
                        {assetTypeLabel(h.assetType)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {option ? (
                        <>
                          {h.shares} contract{h.shares === 1 ? "" : "s"}
                          {h.optionType ? ` · ${h.optionType}` : ""}
                          {h.expirationLabel ? ` · exp ${h.expirationLabel}` : ""}
                          {" · "}
                          {fmtPremium(h.currentPrice)} premium
                        </>
                      ) : (
                        <>
                          {h.shares} share{h.shares === 1 ? "" : "s"}
                          {h.sector ? ` · ${h.sector}` : ` · ${assetTypeLabel(h.assetType)}`}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-text">{fmt(value)}</p>
                    <p className={`text-xs font-semibold ${positive ? "text-success" : "text-danger"}`}>
                      {positive ? "+" : ""}{gainP}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "behavioral" && (
          <div className="space-y-3">
            {behavioralAlerts.length === 0 && !monthlyComparison ? (
              <p className="px-1 py-4 text-center text-sm text-text-muted">
                No behavioral insights yet. Sync investment activity and bank transactions to see patterns here.
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

            {monthlyComparison ? (
              <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
                <p className="mb-2 text-sm font-semibold text-text">Investment vs. spending this month</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[var(--radius-sm)] bg-success/10 p-3">
                    <p className="text-xs text-text-muted">Invested</p>
                    <p className="text-lg font-extrabold text-success">
                      {fmt(Number.parseFloat(monthlyComparison.monthlyInvest))}
                    </p>
                  </div>
                  <div className="rounded-[var(--radius-sm)] bg-surface-raised p-3">
                    <p className="text-xs text-text-muted">Spent dining</p>
                    <p className="text-lg font-extrabold text-text">
                      {fmt(Number.parseFloat(monthlyComparison.diningSpend))}
                    </p>
                  </div>
                </div>
                {monthlyComparison.summary ? (
                  <p className="mt-2 text-xs text-text-muted">{monthlyComparison.summary}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
