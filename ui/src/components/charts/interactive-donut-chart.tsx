"use client";

import { ArcElement, Chart as ChartJS, Legend, Tooltip } from "chart.js";
import clsx from "clsx";
import { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";

import { ChartShell } from "@/components/charts/chart-shell";
import { formatCurrency } from "@/lib/chart-utils";
import { getCategoryColor, getSubCategoryColor } from "@/lib/category-colors";
import type { ChartCategorySlice } from "@/types/api";

ChartJS.register(ArcElement, Tooltip, Legend);

interface InteractiveDonutChartProps {
  slices: ChartCategorySlice[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  /** When set, slice colors use shades of this parent category (subcategory drill-down). */
  parentCategory?: string;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function InteractiveDonutChart({
  slices,
  selectedCategory,
  onSelectCategory,
  parentCategory,
  title = "By category",
  subtitle = "Click a slice to filter",
  className,
}: InteractiveDonutChartProps) {
  const total = useMemo(
    () => slices.reduce((sum, slice) => sum + Number.parseFloat(slice.amount), 0),
    [slices],
  );

  const chartData = useMemo(
    () => ({
      labels: slices.map((slice) => slice.name),
      datasets: [
        {
          data: slices.map((slice) => Number.parseFloat(slice.amount)),
          backgroundColor: slices.map((slice, index) => {
            const color = parentCategory
              ? getSubCategoryColor(parentCategory, index)
              : getCategoryColor(slice.name);
            if (selectedCategory && selectedCategory !== slice.name) {
              return parentCategory ? `${color}` : `${color}55`;
            }
            return color;
          }),
          borderWidth: 0,
          hoverOffset: 12,
          spacing: 2,
        },
      ],
    }),
    [slices, selectedCategory, parentCategory],
  );

  const centerLabel = selectedCategory || "Total spent";
  const centerValue = selectedCategory
    ? slices.find((slice) => slice.name === selectedCategory)?.amount ?? "0"
    : total.toFixed(2);

  return (
    <ChartShell
      title={title}
      subtitle={subtitle}
      className={clsx("relative", className)}
    >
      <div className="relative h-72">
        {slices.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-text-muted">
            No category data
          </p>
        ) : (
          <>
            <Doughnut
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: "72%",
                animation: { animateRotate: true, duration: 600 },
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: {
                      color: "#9d96ad",
                      boxWidth: 8,
                      padding: 14,
                      font: { size: 11, weight: "bold" },
                      usePointStyle: true,
                      pointStyle: "circle",
                    },
                    onClick: (_event, legendItem, legend) => {
                      const index = legendItem.index;
                      if (index === undefined) return;
                      const label = legend.chart.data.labels?.[index];
                      if (typeof label === "string") {
                        onSelectCategory(
                          selectedCategory === label ? "" : label,
                        );
                      }
                    },
                  },
                  tooltip: {
                    backgroundColor: "rgba(26, 22, 37, 0.92)",
                    padding: 12,
                    cornerRadius: 10,
                    callbacks: {
                      label: (context) => {
                        const value = context.parsed;
                        const pct = total > 0 ? ((value / total) * 100).toFixed(2) : "0.00";
                        return `${formatCurrency(value)} (${pct}%)`;
                      },
                    },
                  },
                },
                onClick: (_event, elements, chart) => {
                  if (elements.length === 0) return;
                  const index = elements[0]?.index;
                  if (index === undefined) return;
                  const label = chart.data.labels?.[index];
                  if (typeof label === "string") {
                    onSelectCategory(
                      selectedCategory === label ? "" : label,
                    );
                  }
                },
              }}
            />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-16">
              <p className="max-w-[120px] truncate text-center text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                {centerLabel}
              </p>
              <p
                className="mt-1 text-xl font-extrabold tabular-nums text-text"
                data-money
              >
                {formatCurrency(Number.parseFloat(centerValue))}
              </p>
            </div>
          </>
        )}
      </div>
    </ChartShell>
  );
}
