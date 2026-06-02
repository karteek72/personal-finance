"use client";

import { useTheme } from "@/hooks/use-theme";

interface TopBarProps {
  title: string;
}

function ThemeToggleIcon({ theme }: { theme: "light" | "dark" }) {
  if (theme === "dark") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 2v2M12 20v2M20 12h2M2 12h2M17.66 6.34l-1.41 1.41M7.75 16.25l-1.41 1.41M17.66 17.66l-1.41-1.41M7.75 7.75 6.34 6.34"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        d="M19 14.5A7.5 7.5 0 0 1 9.5 5 7.5 7.5 0 1 0 19 14.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function TopBar({ title }: TopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const year = new Date().getFullYear();

  return (
    <header className="sticky top-0 z-20 px-4 pt-4 md:px-6 md:pt-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-text-muted md:hidden">
            {getGreeting()}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-text md:text-3xl">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden rounded-[var(--radius-pill)] bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary sm:inline">
            {year}
          </span>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-surface text-text-muted transition-colors hover:text-primary card-shadow"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          >
            <ThemeToggleIcon theme={theme} />
          </button>
        </div>
      </div>
    </header>
  );
}
