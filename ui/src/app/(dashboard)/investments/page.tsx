"use client";

import { useState } from "react";

const PREVIEW_BANNER = (
  <div className="mb-5 flex items-center gap-2 rounded-[var(--radius-sm)] border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
    <span><strong>Preview</strong> — Investment Analysis is a planned feature. Data shown is illustrative.</span>
  </div>
);

const HOLDINGS = [
  { ticker: "AAPL", name: "Apple Inc.", shares: 12, costBasis: 142, currentPrice: 211, sector: "Technology" },
  { ticker: "VOO", name: "Vanguard S&P 500", shares: 8, costBasis: 380, currentPrice: 498, sector: "ETF" },
  { ticker: "MSFT", name: "Microsoft Corp.", shares: 5, costBasis: 310, currentPrice: 421, sector: "Technology" },
  { ticker: "TSLA", name: "Tesla Inc.", shares: 15, costBasis: 248, currentPrice: 176, sector: "Auto" },
  { ticker: "AMZN", name: "Amazon.com Inc.", shares: 3, costBasis: 155, currentPrice: 202, sector: "Consumer" },
  { ticker: "BTC", name: "Bitcoin", shares: 0.12, costBasis: 38000, currentPrice: 69400, sector: "Crypto" },
];

const BEHAVIORAL_ALERTS = [
  {
    type: "warning",
    title: "Panic sell pattern detected",
    desc: "You sold TSLA three times during market dips > 5%. All three positions recovered within 14 days — avg opportunity cost: $840",
  },
  {
    type: "info",
    title: "Sector concentration",
    desc: "62% of your portfolio is in Technology. Consider diversifying to reduce correlated risk.",
  },
  {
    type: "positive",
    title: "Spend-to-invest correlation",
    desc: "On weeks markets dropped >2%, you spent 23% more on dining and entertainment. This week the market is down 3.1%.",
  },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function pct(cost: number, current: number) {
  return (((current - cost) / cost) * 100).toFixed(1);
}

export default function InvestmentsPage() {
  const [activeTab, setActiveTab] = useState<"portfolio" | "behavioral">("portfolio");

  const totalValue = HOLDINGS.reduce((s, h) => s + h.shares * h.currentPrice, 0);
  const totalCost = HOLDINGS.reduce((s, h) => s + h.shares * h.costBasis, 0);
  const totalGain = totalValue - totalCost;
  const gainPct = ((totalGain / totalCost) * 100).toFixed(1);

  return (
    <div className="space-y-5">
      {PREVIEW_BANNER}

      {/* Portfolio summary */}
      <div
        className="rounded-[var(--radius-lg)] p-5"
        style={{ background: "var(--gradient-hero)" }}
      >
        <p className="text-sm font-medium text-white/70">Portfolio value</p>
        <p className="mt-1 text-5xl font-extrabold tracking-tight text-white">{fmt(totalValue)}</p>
        <div className="mt-2 flex gap-4">
          <div>
            <p className="text-xs text-white/60">Total return</p>
            <p className="text-sm font-bold text-white">+{fmt(totalGain)} ({gainPct}%)</p>
          </div>
          <div>
            <p className="text-xs text-white/60">Cost basis</p>
            <p className="text-sm font-bold text-white">{fmt(totalCost)}</p>
          </div>
          <div>
            <p className="text-xs text-white/60">YTD return</p>
            <p className="text-sm font-bold text-white">+12.4%</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-[var(--radius-sm)] bg-surface-raised p-1">
        {(["portfolio", "behavioral"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-[var(--radius-sm)] py-1.5 text-sm font-semibold capitalize transition-all ${
              activeTab === tab ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"
            }`}
          >
            {tab === "portfolio" ? "Holdings" : "Behavioral Patterns"}
          </button>
        ))}
      </div>

      {activeTab === "portfolio" && (
        <div className="space-y-2">
          {HOLDINGS.map((h) => {
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
          {BEHAVIORAL_ALERTS.map((alert, i) => (
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

          {/* Spend correlation */}
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
  );
}
