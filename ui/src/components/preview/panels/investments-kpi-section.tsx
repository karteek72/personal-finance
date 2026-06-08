"use client";

import { useMemo, useState } from "react";

import { InteractiveBarChart } from "@/components/charts/interactive-bar-chart";
import { InteractiveDonutChart } from "@/components/charts/interactive-donut-chart";
import { formatMoneyValue } from "@/lib/format-money";
import type { InvestmentsResponse } from "@/types/api";

interface Props {
  data: InvestmentsResponse;
}

function plClass(n: number) {
  return n >= 0 ? "text-success" : "text-danger";
}

export function InvestmentsKpiSection({ data }: Props) {
  const [selectedSector, setSelectedSector] = useState("");
  const analytics = data.portfolioAnalytics;
  const trend = data.portfolioValueTrend;
  const gainLoss = Number.parseFloat(data.totalGainLoss);

  const allocationSlices = useMemo(
    () =>
      [
        {
          name: "Stocks & ETFs",
          amount: data.portfolioBreakdown.stocksValue,
          percentage: data.portfolioBreakdown.stocksSharePercent,
        },
        {
          name: "Options",
          amount: data.portfolioBreakdown.optionsValue,
          percentage: data.portfolioBreakdown.optionsSharePercent,
        },
        {
          name: "Other",
          amount: data.portfolioBreakdown.otherValue,
          percentage: Math.max(
            0,
            100 -
              data.portfolioBreakdown.stocksSharePercent -
              data.portfolioBreakdown.optionsSharePercent,
          ),
        },
      ].filter((s) => Number.parseFloat(s.amount) > 0),
    [data.portfolioBreakdown],
  );

  const sectorSlices = useMemo(
    () =>
      analytics.sectorAllocation.map((s) => ({
        name: s.sector,
        amount: s.value,
        percentage: s.sharePercent,
      })),
    [analytics.sectorAllocation],
  );

  const trendSlices = useMemo(
    () =>
      trend.points.map((p) => ({
        id: p.month,
        name: p.month,
        amount: p.value,
        percentage: 0,
      })),
    [trend.points],
  );

  const winnersLosersSlices = useMemo(
    () => [
      {
        id: "winners",
        name: "Winners",
        amount: analytics.winners.value,
        percentage: analytics.winners.sharePercent,
      },
      {
        id: "losers",
        name: "Losers",
        amount: analytics.losers.value,
        percentage: analytics.losers.sharePercent,
      },
    ],
    [analytics.losers, analytics.winners],
  );

  return (
    <div className="space-y-4">
      <div
        className="rounded-[var(--radius-lg)] p-5"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-white/70">Portfolio value</p>
            <p className="mt-1 text-3xl font-extrabold text-white">
              {formatMoneyValue(Number.parseFloat(data.portfolioValue))}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-white/70">Unrealized P/L</p>
            <p className={`mt-1 text-2xl font-bold ${plClass(gainLoss)}`}>
              {gainLoss >= 0 ? "+" : ""}
              {formatMoneyValue(gainLoss)} ({data.totalGainLossPercent}%)
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-white/70">Invested (cost)</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {formatMoneyValue(Number.parseFloat(data.totalCostBasis))}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-white/70">Win rate</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {analytics.winRate}%
            </p>
            <p className="text-[10px] text-white/60">
              {analytics.winners.count} winners · {analytics.losers.count} losers
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[var(--radius-sm)] bg-white/10 px-3 py-2">
            <p className="text-[10px] uppercase text-white/60">Gross profit</p>
            <p className="text-sm font-semibold text-success">
              {formatMoneyValue(Number.parseFloat(analytics.unrealizedProfit.total))}
              <span className="ml-1 text-[10px] font-normal text-white/60">
                ({analytics.unrealizedProfit.positionCount} positions)
              </span>
            </p>
          </div>
          <div className="rounded-[var(--radius-sm)] bg-white/10 px-3 py-2">
            <p className="text-[10px] uppercase text-white/60">Gross loss</p>
            <p className="text-sm font-semibold text-danger">
              {formatMoneyValue(Number.parseFloat(analytics.unrealizedLoss.total))}
              <span className="ml-1 text-[10px] font-normal text-white/60">
                ({analytics.unrealizedLoss.positionCount} positions)
              </span>
            </p>
          </div>
        </div>
      </div>

      {analytics.caveats.length > 0 ? (
        <p className="text-xs text-text-muted">{analytics.caveats.join(" ")}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <InteractiveDonutChart
          slices={allocationSlices}
          selectedCategory=""
          onSelectCategory={() => undefined}
          colorScheme="asset"
          title="Asset allocation"
          subtitle="By asset class"
        />
        {sectorSlices.length > 0 ? (
          <InteractiveDonutChart
            slices={sectorSlices}
            selectedCategory={selectedSector}
            onSelectCategory={setSelectedSector}
            colorScheme="sector"
            title="Sector allocation"
            subtitle="By GICS sector"
          />
        ) : null}
        <InteractiveBarChart
          slices={winnersLosersSlices}
          selectedAccountId=""
          onSelectAccount={() => undefined}
          colorScheme="semantic"
          title="Winners vs losers"
          subtitle="By position value"
          className="min-h-[220px]"
        />
        {trendSlices.length > 0 ? (
          <InteractiveBarChart
            slices={trendSlices}
            selectedAccountId=""
            onSelectAccount={() => undefined}
            colorScheme="diverse"
            title="Portfolio value trend"
            subtitle="Monthly snapshots"
            className="min-h-[220px]"
          />
        ) : (
          <p className="text-sm text-text-muted">{trend.caveats.join(" ")}</p>
        )}
      </div>
    </div>
  );
}
