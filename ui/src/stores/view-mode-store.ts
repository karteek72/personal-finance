"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewScope = "all" | "household" | "personal";

interface ViewModeState {
  scope: ViewScope;
  setScope: (scope: ViewScope) => void;
}

export const useViewModeStore = create<ViewModeState>()(
  persist(
    (set) => ({
      scope: "household",
      setScope: (scope) => set({ scope }),
    }),
    { name: "spendflow-view-mode" },
  ),
);
