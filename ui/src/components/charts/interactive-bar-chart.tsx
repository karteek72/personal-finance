"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { useMemo } from "react";
import { Bar } from "react-chartjs-2";

import { ChartShell } from "@/components/charts/chart-shell";
import { formatCurrency, formatCurrencyCompact } from "@/lib/chart-utils";
import type { ChartAccountSlice } from "@/types/api";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface InteractiveBarChartProps {
  slices: ChartAccountSlice[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  className?: string;
}

export function InteractiveBarChart({
  slices,
  selectedAccountId,
  onSelectAccount,
  className,
}: InteractiveBarChartProps) {
  const sorted = useMemo(
    () => [...slices].sort((a, b) => Number.parseFloat(b.amount) - Number.parseFloat(a.amount)),
    [slices],
  );

  const chartData = useMemo(
    () => ({
      labels: sorted.map((slice) => slice.name),
      datasets: [
        {
          label: "Spend",
          data: sorted.map((slice) => Number.parseFloat(slice.amount)),
          backgroundColor: sorted.map((slice) =>
            selectedAccountId && selectedAccountId !== slice.id
              ? "rgba(124, 58, 237, 0.25)"
              : "rgba(124, 58, 237, 0.85)",
          ),
          borderRadius: 10,
          borderSkipped: false,
          barThickness: 18,
        },
      ],
    }),
    [sorted, selectedAccountId],
  );

  return (
    <ChartShell
      title="By account"
      subtitle="Click a bar to filter"
      className={className}
    >
      <div className="h-64">
        {sorted.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-text-muted">
            No account data
          </p>
        ) : (
          <Bar
            data={chartData}
            options={{
              indexAxis: "y" as const,
              responsive: true,
              maintainAspectRatio: false,
              animation: { duration: 500, easing: "easeOutQuart" },
              interaction: { mode: "nearest", intersect: true, axis: "y" },
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: "rgba(26, 22, 37, 0.92)",
                  padding: 12,
                  cornerRadius: 10,
                  callbacks: {
                    label: (context) => {
                      const slice = sorted[context.dataIndex];
                      const value = context.parsed.x ?? 0;
                        const pct = slice?.percentage.toFixed(2) ?? "0.00";
                      return `${formatCurrency(value)} (${pct}%)`;
                    },
                  },
                },
              },
              scales: {
                x: {
                  grid: { color: "rgba(232, 229, 240, 0.5)" },
                  ticks: {
                    color: "#9d96ad",
                    font: { size: 11 },
                    callback: (value) => formatCurrencyCompact(Number(value)),
                  },
                  border: { display: false },
                },
                y: {
                  grid: { display: false },
                  ticks: {
                    color: "#6b6578",
                    font: { size: 11, weight: "bold" },
                  },
                  border: { display: false },
                },
              },
              onClick: (_event, elements, chart) => {
                if (elements.length === 0) return;
                const index = elements[0]?.index;
                if (index === undefined) return;
                const slice = sorted[index];
                if (!slice) return;
                onSelectAccount(
                  selectedAccountId === slice.id ? "" : slice.id,
                );
              },
            }}
          />
        )}
      </div>
    </ChartShell>
  );
}
