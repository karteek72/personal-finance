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
  sector: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function pct(cost: number, current: number) {
  return (((current - cost) / cost) * 100).toFixed(1);
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
    sector: h.sector ?? h.assetType,
  }));

  const behavioralAlerts = investments?.behavioralAlerts ?? [];

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
            {holdings.map((h) => {
              const value = h.shares * h.currentPrice;
              const gain = h.currentPrice - h.costBasis;
              const gainP = pct(h.costBasis, h.currentPrice);
              const positive = gain >= 0;
              return (
                <div
                  key={h.ticker}
                  className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-3.5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface-raised font-bold text-xs text-text">
                    {h.ticker}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text">{h.name}</p>
                    <p className="text-xs text-text-muted">
                      {h.shares} shares · {h.sector}
                    </p>
                  </div>
                  <div className="text-right">
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

            <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-text mb-2">Investment vs. spending this month</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[var(--radius-sm)] bg-success/10 p-3">
                  <p className="text-xs text-text-muted">Invested</p>
                  <p className="text-lg font-extrabold text-success">$800</p>
                </div>
                <div className="rounded-[var(--radius-sm)] bg-surface-raised p-3">
                  <p className="text-xs text-text-muted">Spent dining</p>
                  <p className="text-lg font-extrabold text-text">$487</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-text-muted">Invest-to-dine ratio: 1.64 — good balance.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
