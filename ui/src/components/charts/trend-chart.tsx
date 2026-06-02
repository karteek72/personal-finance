"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import clsx from "clsx";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface TrendChartProps {
  labels: string[];
  data: number[];
  label: string;
  className?: string;
}

export function TrendChart({
  labels,
  data,
  label,
  className,
}: TrendChartProps) {
  const chartData = {
    labels,
    datasets: [
      {
        label,
        data,
        backgroundColor: "var(--color-primary)",
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: { parsed: { y: number | null } }) =>
            `${label}: ${context.parsed.y?.toLocaleString() ?? "0"}`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: "var(--color-text-muted)",
          font: { size: 11 },
        },
        border: {
          display: false,
        },
      },
      y: {
        grid: {
          color: "color-mix(in srgb, var(--color-border) 50%, transparent)",
        },
        ticks: {
          color: "var(--color-text-muted)",
          font: { size: 11 },
        },
        border: {
          display: false,
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
      <div className="h-56">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
