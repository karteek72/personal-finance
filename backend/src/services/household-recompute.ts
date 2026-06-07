import { createLogger } from "../lib/logger.js";
import { recomputeAllAnalytics } from "./recompute-all-analytics.js";

const log = createLogger("household.recompute");

/** Fire-and-forget analytics refresh after household membership changes. */
export function scheduleHouseholdRecompute(userId: string): void {
  void recomputeAllAnalytics(userId)
    .then((result) => {
      const failed = result.steps.find((step) => !step.ok);
      if (failed) {
        log.warn(
          { userId, step: failed.step, detail: failed.detail },
          "household recompute completed with failures",
        );
      } else {
        log.info({ userId }, "household recompute completed");
      }
    })
    .catch((err: unknown) => {
      log.error({ err, userId }, "household recompute failed");
    });
}
