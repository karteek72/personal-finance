"use client";

import { useEffect } from "react";

import { getSystemTheme, useTheme } from "@/hooks/use-theme";

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { theme, hasHydrated, setTheme } = useTheme();

  useEffect(() => {
    const stored = localStorage.getItem("spendflow-theme");
    if (!stored) {
      setTheme(getSystemTheme());
    }
  }, [setTheme]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.classList.toggle("dark", theme === "dark");
  }, [theme, hasHydrated]);

  return children;
}
