import { createLogger } from "../lib/logger.js";
import { evaluateUserAlerts } from "./alert-engine.js";
import { upsertBalanceSnapshotsForAccountIds } from "./balance-snapshots.js";
import { refreshChallenges } from "./challenge-engine.js";
import { refreshHabitStreaks } from "./habit-streak-engine.js";
import { refreshFireProfile } from "./investment-analytics.js";
import { resolveHouseholdContext } from "./household-access.js";
import { resolveActiveAccountScope } from "./active-account-scope.js";
import { refreshProtectProfiles } from "./protect-analytics.js";
import { refreshAnalyticsMarts } from "./refresh-marts.js";
import { refreshTransferLinks } from "./transfer-pairing.js";

const log = createLogger("analytics.recompute");

export interface RecomputeStepResult {
  step: string;
  ok: boolean;
  detail?: string;
}

export interface RecomputeAllAnalyticsResult {
  steps: RecomputeStepResult[];
}

async function runStep(
  step: string,
  fn: () => Promise<string | number | void>,
): Promise<RecomputeStepResult> {
  try {
    const detailValue = await fn();
    const detail =
      detailValue == null
        ? undefined
        : typeof detailValue === "number"
          ? String(detailValue)
          : detailValue;
    return { step, ok: true, detail };
  } catch (err) {
    log.error({ err, step }, "recompute step failed");
    const message = err instanceof Error ? err.message : "unknown error";
    return { step, ok: false, detail: message };
  }
}

/** Idempotent full analytics refresh for one user. */
export async function recomputeAllAnalytics(
  userId: string,
): Promise<RecomputeAllAnalyticsResult> {
  const steps: RecomputeStepResult[] = [];

  steps.push(
    await runStep("refreshTransferLinks", async () => {
      const links = await refreshTransferLinks(userId);
      return `links=${links}`;
    }),
  );

  steps.push(
    await runStep("refreshAnalyticsMarts", async () => {
      await refreshAnalyticsMarts(true);
    }),
  );

  steps.push(
    await runStep("refreshProtectProfiles", async () => {
      const ok = await refreshProtectProfiles(userId);
      return ok ? "refreshed" : "skipped";
    }),
  );

  steps.push(
    await runStep("evaluateUserAlerts", async () => {
      await evaluateUserAlerts(userId);
    }),
  );

  steps.push(
    await runStep("refreshFireProfile", async () => {
      await refreshFireProfile(userId);
    }),
  );

  steps.push(
    await runStep("upsertBalanceSnapshots", async () => {
      const ctx = await resolveHouseholdContext(userId);
      const { accountIds, hasActiveAccounts } = await resolveActiveAccountScope(
        ctx.userIds,
      );
      if (!hasActiveAccounts) return "skipped";
      await upsertBalanceSnapshotsForAccountIds(accountIds);
      return `accounts=${accountIds.length}`;
    }),
  );

  steps.push(
    await runStep("refreshHabitStreaks", async () => {
      await refreshHabitStreaks(userId);
    }),
  );

  steps.push(
    await runStep("refreshChallenges", async () => {
      await refreshChallenges(userId);
    }),
  );

  return { steps };
}
