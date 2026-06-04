"use client";

import type { ReactNode } from "react";

import {
  FeatureEmptyState,
  FeaturePanelLoading,
} from "@/components/preview/feature-empty-state";
import { useHasActiveAccounts } from "@/hooks/use-has-active-accounts";

export type FeaturePanelGateResult =
  | { ready: false; node: ReactNode }
  | { ready: true };

/** Blocks preview panels when there are no connected accounts. */
export function useFeaturePanelGate(feature?: string): FeaturePanelGateResult {
  const { hasAccounts, isLoading } = useHasActiveAccounts();

  if (isLoading) {
    return { ready: false, node: <FeaturePanelLoading /> };
  }
  if (!hasAccounts) {
    return { ready: false, node: <FeatureEmptyState feature={feature} /> };
  }
  return { ready: true };
}
