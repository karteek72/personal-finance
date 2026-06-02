"use client";

import clsx from "clsx";

import { useTheme } from "@/hooks/use-theme";

interface TopBarProps {
  title: string;
  year?: number;
  onExportCsv?: () => void;
}

function ThemeToggleIcon({ theme }: { theme: "light" | "dark" }) {
  if (theme === "dark") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
        <circle cx="8" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.25" />
        <path
          d="M8 1.5v1.25M8 13.25V14.5M14.5 8H13.25M2.75 8H1.5M12.4 3.6l-.88.88M4.48 11.52l-.88.88M12.4 12.4l-.88-.88M4.48 4.48l-.88-.88"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12.8 10.2A5.5 5.5 0 0 1 5.8 3.2 5.5 5.5 0 1 0 12.8 10.2Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TopBar({
  title,
  year = new Date().getFullYear(),
  onExportCsv,
}: TopBarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <h1 className="text-2xl font-bold text-text">{title}</h1>

        <div className="flex items-center gap-2">
          <span className="rounded-[var(--radius-pill)] border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text tabular-nums">
            {year}
          </span>

          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center justify-center rounded-[var(--radius-card)] border border-border bg-surface p-2 text-text-muted transition-colors hover:border-primary/50 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          >
            <ThemeToggleIcon theme={theme} />
          </button>

          <button
            type="button"
            onClick={onExportCsv}
            className={clsx(
              "rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition-colors hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              !onExportCsv && "cursor-default opacity-70",
            )}
          >
            Export CSV
          </button>
        </div>
      </div>
    </header>
  );
}
