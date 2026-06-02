"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { useMemo } from "react";
import { Line } from "react-chartjs-2";

import { ChartShell } from "@/components/charts/chart-shell";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatMonthLabel,
} from "@/lib/chart-utils";
import { getCategoryColor } from "@/lib/category-colors";
import type { CategoryTrend } from "@/types/api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
);

interface InteractiveMultiLineChartProps {
  trends: CategoryTrend[];
  highlightedCategory?: string;
  onSelectCategory?: (category: string) => void;
  className?: string;
  title?: string;
  subtitle?: string;
}

export function InteractiveMultiLineChart({
  trends,
  highlightedCategory,
  onSelectCategory,
  className,
  title = "Category trends",
  subtitle = "Compare spending over time",
}: InteractiveMultiLineChartProps) {
  const months = useMemo(() => {
    const monthSet = new Set<string>();
    for (const trend of trends) {
      for (const point of trend.months) {
        monthSet.add(point.month);
      }
    }
    return [...monthSet].sort((a, b) => a.localeCompare(b));
  }, [trends]);

  const labels = months.map(formatMonthLabel);

  const datasets = useMemo(
    () =>
      trends.map((trend) => {
        const color = getCategoryColor(trend.name);
        const dimmed =
          highlightedCategory && highlightedCategory !== trend.name;
        const monthMap = new Map(
          trend.months.map((point) => [point.month, Number.parseFloat(point.amount)]),
        );

        return {
          label: trend.name,
          data: months.map((month) => monthMap.get(month) ?? 0),
          borderColor: dimmed ? `${color}55` : color,
          backgroundColor: color,
          tension: 0.35,
          pointRadius: dimmed ? 0 : 3,
          pointHoverRadius: 6,
          borderWidth: dimmed ? 1.5 : 2.5,
        };
      }),
    [trends, months, highlightedCategory],
  );

  return (
    <ChartShell title={title} subtitle={subtitle} className={className}>
      <div className="h-72">
        {trends.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-text-muted">
            No trend data
          </p>
        ) : (
          <Line
            data={{ labels, datasets }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: "nearest", intersect: false },
              animation: { duration: 500 },
              plugins: {
                legend: {
                  position: "bottom",
                  labels: {
                    color: "#9d96ad",
                    boxWidth: 8,
                    padding: 12,
                    font: { size: 11, weight: "bold" },
                    usePointStyle: true,
                    pointStyle: "circle",
                  },
                  onClick: (_event, legendItem) => {
                    const label = legendItem.text;
                    if (label && onSelectCategory) {
                      onSelectCategory(
                        highlightedCategory === label ? "" : label,
                      );
                    }
                  },
                },
                tooltip: {
                  backgroundColor: "rgba(26, 22, 37, 0.92)",
                  padding: 12,
                  cornerRadius: 10,
                  callbacks: {
                    label: (context) =>
                      `${context.dataset.label}: ${formatCurrency(context.parsed.y ?? 0)}`,
                  },
                },
              },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: { color: "#9d96ad", font: { size: 11 } },
                  border: { display: false },
                },
                y: {
                  grid: { color: "rgba(232, 229, 240, 0.5)" },
                  ticks: {
                    color: "#9d96ad",
                    font: { size: 11 },
                    callback: (value) => formatCurrencyCompact(Number(value)),
                  },
                  border: { display: false },
                },
              },
            }}
          />
        )}
      </div>
    </ChartShell>
  );
}
