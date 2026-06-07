import { createLogger } from "../lib/logger.js";
import { evaluateUserAlerts } from "./alert-engine.js";
import { refreshProtectProfiles } from "./protect-analytics.js";
import { refreshAnalyticsMarts } from "./refresh-marts.js";

const log = createLogger("analytics.post-sync");

/** Run analytics refresh steps after account/investment sync completes. */
export async function runPostSyncAnalytics(userId: string): Promise<void> {
  try {
    await refreshAnalyticsMarts();
    await refreshProtectProfiles(userId);
    await evaluateUserAlerts(userId);
  } catch (err) {
    log.error({ err, userId }, "post-sync analytics failed");
    throw err;
  }
}
