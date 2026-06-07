"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import clsx from "clsx";
import { useMemo, useRef, useState } from "react";
import { Line } from "react-chartjs-2";

import { ChartShell } from "@/components/charts/chart-shell";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatMonthLabel,
} from "@/lib/chart-utils";
import type { ChartMonthlyPoint } from "@/types/api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

type MetricKey = "expenses" | "income" | "net";

interface InteractiveAreaChartProps {
  monthly: ChartMonthlyPoint[];
  className?: string;
}

const METRICS: { id: MetricKey; label: string; color: string }[] = [
  { id: "expenses", label: "Spent", color: "#7c3aed" },
  { id: "income", label: "Income", color: "#22c55e" },
  { id: "net", label: "Net", color: "#f472b6" },
];

function metricValue(point: ChartMonthlyPoint, metric: MetricKey): number {
  return Number.parseFloat(point[metric]);
}

export function InteractiveAreaChart({
  monthly,
  className,
}: InteractiveAreaChartProps) {
  const chartRef = useRef<ChartJS<"line">>(null);
  const [activeMetrics, setActiveMetrics] = useState<MetricKey[]>([
    "expenses",
    "income",
  ]);
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  const labels = useMemo(
    () => monthly.map((point) => formatMonthLabel(point.month)),
    [monthly],
  );

  const datasets = useMemo(
    () =>
      METRICS.filter((metric) => activeMetrics.includes(metric.id)).map(
        (metric) => ({
          label: metric.label,
          data: monthly.map((point) => metricValue(point, metric.id)),
          borderColor: metric.color,
          backgroundColor: (context: {
            chart: ChartJS;
            datasetIndex: number;
          }) => {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            if (!chartArea) return `${metric.color}33`;
            const gradient = ctx.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom,
            );
            gradient.addColorStop(0, `${metric.color}40`);
            gradient.addColorStop(1, `${metric.color}05`);
            return gradient;
          },
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: metric.color,
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          borderWidth: 2.5,
        }),
      ),
    [activeMetrics, monthly],
  );

  const hoveredIndex = hoveredMonth
    ? monthly.findIndex((point) => point.month === hoveredMonth)
    : monthly.length - 1;

  const highlightPoint =
    hoveredIndex >= 0 ? monthly[hoveredIndex] : monthly.at(-1);

  const headlineMetrics = activeMetrics.length > 0 ? activeMetrics : (["expenses"] as MetricKey[]);

  function toggleMetric(metric: MetricKey) {
    setActiveMetrics((current) => {
      if (current.includes(metric)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== metric);
      }
      return [...current, metric];
    });
  }

  return (
    <ChartShell
      title="Monthly trend"
      subtitle="Hover a point · toggle lines below"
      className={className}
      action={
        highlightPoint ? (
          <div className="space-y-0.5 text-right">
            <p className="text-xs text-text-muted">
              {formatMonthLabel(highlightPoint.month)}
            </p>
            {headlineMetrics.map((metric) => {
              const meta = METRICS.find((m) => m.id === metric)!;
              return (
                <p
                  key={metric}
                  className="text-sm font-bold tabular-nums text-text"
                  data-money
                >
                  {formatCurrency(Number.parseFloat(highlightPoint[metric]))}{" "}
                  {meta.label.toLowerCase()}
                </p>
              );
            })}
          </div>
        ) : null
      }
      footer={
        <div className="flex flex-wrap gap-2">
          {METRICS.map((metric) => {
            const active = activeMetrics.includes(metric.id);
            return (
              <button
                key={metric.id}
                type="button"
                onClick={() => toggleMetric(metric.id)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-all",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-text-muted hover:text-text",
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: metric.color }}
                />
                {metric.label}
              </button>
            );
          })}
        </div>
      }
    >
      <div className="h-64">
        {monthly.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-text-muted">
            No data for this filter
          </p>
        ) : (
          <Line
            ref={chartRef}
            data={{ labels, datasets }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: "index", intersect: false },
              animation: { duration: 500, easing: "easeOutQuart" },
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: "rgba(26, 22, 37, 0.92)",
                  padding: 12,
                  cornerRadius: 10,
                  callbacks: {
                    label: (context) => {
                      const value = context.parsed.y ?? 0;
                      return `${context.dataset.label}: ${formatCurrency(value)}`;
                    },
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
                  grid: {
                    color: "rgba(232, 229, 240, 0.5)",
                  },
                  ticks: {
                    color: "#9d96ad",
                    font: { size: 11 },
                    callback: (value) => formatCurrencyCompact(Number(value)),
                  },
                  border: { display: false },
                },
              },
              onHover: (_event, elements) => {
                if (elements.length > 0) {
                  const index = elements[0]?.index ?? -1;
                  if (index >= 0 && monthly[index]) {
                    setHoveredMonth(monthly[index].month);
                  }
                } else {
                  setHoveredMonth(null);
                }
              },
            }}
          />
        )}
      </div>
    </ChartShell>
  );
}
