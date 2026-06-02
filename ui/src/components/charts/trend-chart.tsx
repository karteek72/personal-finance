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
        borderRadius: 4,
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
        bodyFont: {
          family: "var(--font-mono, ui-monospace, monospace)",
        },
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
        },
        border: {
          color: "var(--color-border)",
        },
      },
      y: {
        grid: {
          color: "var(--color-border)",
        },
        ticks: {
          color: "var(--color-text-muted)",
          font: {
            family: "var(--font-mono, ui-monospace, monospace)",
          },
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
        "rounded-[var(--radius-card)] border border-border bg-surface p-4",
        className,
      )}
    >
      <div className="h-64">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
