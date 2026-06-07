"use client";

import { useIsFetching } from "@tanstack/react-query";

import { NotificationBell } from "@/components/notifications/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTheme } from "@/hooks/use-theme";
import { greetingWithName, userDisplayName } from "@/lib/user-display";

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

export function TopBar({ title }: TopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const isFetching = useIsFetching() > 0;
  const user = useCurrentUser();
  const firstName = user ? userDisplayName(user) : null;

  return (
    <header className="sticky top-0 z-20 flex min-w-0 items-center justify-between gap-2 px-4 py-3 md:gap-4 md:px-5 md:py-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {isFetching ? (
          <LoadingSpinner size="sm" label="Updating data" className="shrink-0" />
        ) : null}
        {firstName ? (
          <div className="min-w-0">
            <p className="truncate text-base font-bold tracking-tight text-text sm:text-lg">
              {greetingWithName(firstName)}
            </p>
            <p className="truncate text-xs font-medium text-text-muted md:hidden">{title}</p>
          </div>
        ) : (
          <h1 className="truncate text-lg font-bold tracking-tight text-text sm:text-xl md:hidden">
            {title}
          </h1>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <NotificationBell />
        <UserMenu />
        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-colors hover:bg-primary-soft/40 hover:text-primary"
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
        >
          <ThemeToggleIcon theme={theme} />
        </button>
      </div>
    </header>
  );
}
