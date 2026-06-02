"use client";

import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
} from "chart.js";
import clsx from "clsx";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  className?: string;
}

export function DonutChart({ segments, className }: DonutChartProps) {
  const chartData = {
    labels: segments.map((segment) => segment.label),
    datasets: [
      {
        data: segments.map((segment) => segment.value),
        backgroundColor: segments.map((segment) => segment.color),
        borderWidth: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "60%",
    plugins: {
      legend: {
        position: "right" as const,
        labels: {
          color: "var(--color-text)",
          boxWidth: 12,
          padding: 12,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        bodyFont: {
          family: "var(--font-mono, ui-monospace, monospace)",
        },
        callbacks: {
          label: (context: { label?: string; parsed: number }) =>
            `${context.label ?? ""}: ${context.parsed.toLocaleString()}`,
        },
      },
    },
  };

  return (
    <div
      className={clsx(
        "rounded-[var(--radius-card)] border border-border bg-surface p-4",
        className,
      )}
    >
      <div className="h-64">
        <Doughnut data={chartData} options={options} />
      </div>
    </div>
  );
}
