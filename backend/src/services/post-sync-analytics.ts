export {
  recomputeAllAnalytics,
  type RecomputeAllAnalyticsResult,
  type RecomputeStepResult,
} from "./recompute-all-analytics.js";

import { recomputeAllAnalytics } from "./recompute-all-analytics.js";

/** Run analytics refresh after account/investment sync completes. */
export async function runPostSyncAnalytics(userId: string): Promise<void> {
  const { steps } = await recomputeAllAnalytics(userId);
  const failed = steps.find((s) => !s.ok);
  if (failed) {
    throw new Error(`post-sync analytics failed at ${failed.step}: ${failed.detail ?? ""}`);
  }
}
