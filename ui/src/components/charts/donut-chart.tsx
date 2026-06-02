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
        spacing: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: "var(--color-text-muted)",
          boxWidth: 10,
          padding: 16,
          font: {
            size: 11,
            weight: "bold" as const,
          },
          usePointStyle: true,
          pointStyle: "circle" as const,
        },
      },
      tooltip: {
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
        "rounded-[var(--radius-card)] border border-border/60 bg-surface p-4 card-shadow",
        className,
      )}
    >
      <div className="h-72">
        <Doughnut data={chartData} options={options} />
      </div>
    </div>
  );
}
