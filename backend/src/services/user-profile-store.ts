import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { fireProfiles, users } from "../db/schema.js";
import { AppError } from "../lib/errors.js";
import { formatMoneyAmount, roundDecimal } from "../lib/money.js";
import { serializeUser } from "./auth/user-auth.js";
import { resolveActiveAccountScope } from "./active-account-scope.js";
import {
  computeFireProfileInputs,
  refreshFireProfile,
} from "./investment-analytics.js";
import { resolveHouseholdContext } from "./household-access.js";

export const EMPLOYMENT_STATUS_VALUES = [
  "employed",
  "self_employed",
  "retired",
  "student",
  "other",
] as const;

export const RISK_TOLERANCE_VALUES = [
  "conservative",
  "moderate",
  "aggressive",
] as const;

export type EmploymentStatus = (typeof EMPLOYMENT_STATUS_VALUES)[number];
export type RiskTolerance = (typeof RISK_TOLERANCE_VALUES)[number];

const DEFAULT_ANALYTICS_AGE = 35;
const DEFAULT_WITHDRAWAL_RATE = 4;
const DEFAULT_REAL_RETURN = 6;

export interface UserProfileResponse {
  user: {
    id: string;
    email: string;
    displayName: string | null;
    createdAt: string;
  };
  currentAge: number;
  isDefaultAge: boolean;
  householdSize: number | null;
  annualGrossIncome: string | null;
  targetRetirementAge: number | null;
  employmentStatus: EmploymentStatus | null;
  riskTolerance: RiskTolerance | null;
  withdrawalRate: number;
  realReturn: number;
  hasLinkedAccounts: boolean;
  currentNetWorth: string | null;
  monthlySpend: string | null;
  monthlyInvest: string | null;
}

export interface UserProfilePatch {
  displayName?: string;
  currentAge?: number;
  householdSize?: number | null;
  annualGrossIncome?: number | null;
  targetRetirementAge?: number | null;
  employmentStatus?: EmploymentStatus | null;
  riskTolerance?: RiskTolerance | null;
  withdrawalRate?: number;
  realReturn?: number;
}

/** @deprecated Use UserProfileResponse */
export type AnalyticsProfileResponse = Omit<UserProfileResponse, "user">;

function parseProfileRate(value: string | null | undefined, fallback: number): number {
  if (value == null) return fallback;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? roundDecimal(n, 1) : fallback;
}

function parseEmploymentStatus(value: string | null | undefined): EmploymentStatus | null {
  if (value == null) return null;
  return (EMPLOYMENT_STATUS_VALUES as readonly string[]).includes(value)
    ? (value as EmploymentStatus)
    : null;
}

function parseRiskTolerance(value: string | null | undefined): RiskTolerance | null {
  if (value == null) return null;
  return (RISK_TOLERANCE_VALUES as readonly string[]).includes(value)
    ? (value as RiskTolerance)
    : null;
}

function rowToAnalyticsFields(
  row: typeof fireProfiles.$inferSelect | undefined,
  hasActiveAccounts: boolean,
  live: Awaited<ReturnType<typeof computeFireProfileInputs>>,
): Omit<UserProfileResponse, "user"> {
  if (row) {
    return {
      currentAge: row.currentAge,
      isDefaultAge: !row.ageUserSet,
      householdSize: row.householdSize,
      annualGrossIncome: row.annualGrossIncome,
      targetRetirementAge: row.targetRetirementAge,
      employmentStatus: parseEmploymentStatus(row.employmentStatus),
      riskTolerance: parseRiskTolerance(row.riskTolerance),
      withdrawalRate: parseProfileRate(row.withdrawalRate, DEFAULT_WITHDRAWAL_RATE),
      realReturn: parseProfileRate(row.realReturn, DEFAULT_REAL_RETURN),
      hasLinkedAccounts: hasActiveAccounts,
      currentNetWorth: live?.currentNetWorth ?? row.currentNetWorth,
      monthlySpend: live?.monthlySpend ?? row.monthlySpend,
      monthlyInvest: live?.monthlyInvest ?? row.monthlyInvest,
    };
  }

  return {
    currentAge: DEFAULT_ANALYTICS_AGE,
    isDefaultAge: true,
    householdSize: null,
    annualGrossIncome: null,
    targetRetirementAge: null,
    employmentStatus: null,
    riskTolerance: null,
    withdrawalRate: DEFAULT_WITHDRAWAL_RATE,
    realReturn: DEFAULT_REAL_RETURN,
    hasLinkedAccounts: hasActiveAccounts,
    currentNetWorth: live?.currentNetWorth ?? null,
    monthlySpend: live?.monthlySpend ?? null,
    monthlyInvest: live?.monthlyInvest ?? null,
  };
}

export async function getUserProfile(userId: string): Promise<UserProfileResponse> {
  const db = getDb();
  const [userRow] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!userRow) {
    throw AppError.notFound("User not found");
  }

  const ctx = await resolveHouseholdContext(userId);
  const { hasActiveAccounts } = await resolveActiveAccountScope(ctx.userIds);

  if (hasActiveAccounts) {
    await refreshFireProfile(userId);
  }

  const [profileRow] = await db
    .select()
    .from(fireProfiles)
    .where(eq(fireProfiles.userId, userId))
    .limit(1);

  const live = hasActiveAccounts
    ? await computeFireProfileInputs(userId, ctx.userIds)
    : null;

  return {
    user: serializeUser(userRow),
    ...rowToAnalyticsFields(profileRow, hasActiveAccounts, live),
  };
}

function validateProfilePatch(patch: UserProfilePatch, currentAge: number): void {
  if (patch.displayName != null) {
    const trimmed = patch.displayName.trim();
    if (trimmed.length === 0 || trimmed.length > 100) {
      throw AppError.validation("Name must be 1–100 characters");
    }
  }
  if (patch.currentAge != null && (patch.currentAge < 18 || patch.currentAge > 100)) {
    throw AppError.validation("Age must be between 18 and 100");
  }
  if (
    patch.householdSize != null &&
    patch.householdSize !== undefined &&
    (patch.householdSize < 1 || patch.householdSize > 20)
  ) {
    throw AppError.validation("Household size must be between 1 and 20, or left blank");
  }
  if (
    patch.annualGrossIncome != null &&
    patch.annualGrossIncome !== undefined &&
    (patch.annualGrossIncome < 0 || patch.annualGrossIncome > 50_000_000)
  ) {
    throw AppError.validation("Annual income must be between 0 and 50,000,000");
  }
  const ageForTarget = patch.currentAge ?? currentAge;
  if (
    patch.targetRetirementAge != null &&
    patch.targetRetirementAge !== undefined &&
    (patch.targetRetirementAge < 18 || patch.targetRetirementAge > 100)
  ) {
    throw AppError.validation("Target retirement age must be between 18 and 100");
  }
  if (
    patch.targetRetirementAge != null &&
    patch.targetRetirementAge !== undefined &&
    patch.targetRetirementAge < ageForTarget
  ) {
    throw AppError.validation("Target retirement age must be at or after current age");
  }
  if (
    patch.withdrawalRate != null &&
    (patch.withdrawalRate < 1 || patch.withdrawalRate > 10)
  ) {
    throw AppError.validation("Withdrawal rate must be between 1% and 10%");
  }
  if (patch.realReturn != null && (patch.realReturn < 0 || patch.realReturn > 15)) {
    throw AppError.validation("Real return must be between 0% and 15%");
  }
  if (
    patch.employmentStatus != null &&
    patch.employmentStatus !== undefined &&
    !(EMPLOYMENT_STATUS_VALUES as readonly string[]).includes(patch.employmentStatus)
  ) {
    throw AppError.validation("Invalid employment status");
  }
  if (
    patch.riskTolerance != null &&
    patch.riskTolerance !== undefined &&
    !(RISK_TOLERANCE_VALUES as readonly string[]).includes(patch.riskTolerance)
  ) {
    throw AppError.validation("Invalid risk tolerance");
  }
}

export async function updateUserProfile(
  userId: string,
  patch: UserProfilePatch,
): Promise<UserProfileResponse> {
  const db = getDb();
  const [userRow] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!userRow) {
    throw AppError.notFound("User not found");
  }

  const [existing] = await db
    .select()
    .from(fireProfiles)
    .where(eq(fireProfiles.userId, userId))
    .limit(1);

  const baseAge = existing?.currentAge ?? DEFAULT_ANALYTICS_AGE;
  validateProfilePatch(patch, baseAge);

  if (patch.displayName != null) {
    await db
      .update(users)
      .set({ displayName: patch.displayName.trim() })
      .where(eq(users.id, userId));
  }

  const nextAge =
    patch.currentAge != null ? Math.round(patch.currentAge) : baseAge;
  const nextAgeUserSet =
    patch.currentAge != null ? true : (existing?.ageUserSet ?? false);
  const nextWithdrawal = String(
    patch.withdrawalRate ??
      (existing
        ? Number.parseFloat(existing.withdrawalRate)
        : DEFAULT_WITHDRAWAL_RATE),
  );
  const nextRealReturn = String(
    patch.realReturn ??
      (existing ? Number.parseFloat(existing.realReturn) : DEFAULT_REAL_RETURN),
  );
  const nextHouseholdSize =
    patch.householdSize !== undefined
      ? patch.householdSize
      : (existing?.householdSize ?? null);
  const nextAnnualIncome =
    patch.annualGrossIncome !== undefined
      ? patch.annualGrossIncome == null
        ? null
        : formatMoneyAmount(patch.annualGrossIncome)
      : (existing?.annualGrossIncome ?? null);
  const nextTargetRetirement =
    patch.targetRetirementAge !== undefined
      ? patch.targetRetirementAge
      : (existing?.targetRetirementAge ?? null);
  const nextEmployment =
    patch.employmentStatus !== undefined
      ? patch.employmentStatus
      : parseEmploymentStatus(existing?.employmentStatus ?? null);
  const nextRisk =
    patch.riskTolerance !== undefined
      ? patch.riskTolerance
      : parseRiskTolerance(existing?.riskTolerance ?? null);

  await db
    .insert(fireProfiles)
    .values({
      userId,
      currentAge: nextAge,
      ageUserSet: nextAgeUserSet,
      currentNetWorth: existing?.currentNetWorth ?? "0",
      monthlySpend: existing?.monthlySpend ?? "0",
      monthlyInvest: existing?.monthlyInvest ?? "0",
      withdrawalRate: nextWithdrawal,
      realReturn: nextRealReturn,
      householdSize: nextHouseholdSize,
      annualGrossIncome: nextAnnualIncome,
      targetRetirementAge: nextTargetRetirement,
      employmentStatus: nextEmployment,
      riskTolerance: nextRisk,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: fireProfiles.userId,
      set: {
        currentAge: nextAge,
        ageUserSet: nextAgeUserSet,
        withdrawalRate: nextWithdrawal,
        realReturn: nextRealReturn,
        householdSize: nextHouseholdSize,
        annualGrossIncome: nextAnnualIncome,
        targetRetirementAge: nextTargetRetirement,
        employmentStatus: nextEmployment,
        riskTolerance: nextRisk,
        updatedAt: new Date(),
      },
    });

  const ctx = await resolveHouseholdContext(userId);
  const { hasActiveAccounts } = await resolveActiveAccountScope(ctx.userIds);
  if (hasActiveAccounts) {
    await refreshFireProfile(userId);
  }

  return getUserProfile(userId);
}

/** @deprecated Use getUserProfile */
export async function getAnalyticsProfile(userId: string): Promise<AnalyticsProfileResponse> {
  const profile = await getUserProfile(userId);
  const { user: _user, ...analytics } = profile;
  return analytics;
}

/** @deprecated Use updateUserProfile */
export async function updateAnalyticsProfile(
  userId: string,
  patch: UserProfilePatch,
): Promise<AnalyticsProfileResponse> {
  const profile = await updateUserProfile(userId, patch);
  const { user: _user, ...analytics } = profile;
  return analytics;
}

export type FireProfilePatch = Pick<
  UserProfilePatch,
  "currentAge" | "withdrawalRate" | "realReturn"
>;

export async function updateFireProfileFromPatch(
  userId: string,
  patch: FireProfilePatch,
): Promise<UserProfileResponse> {
  return updateUserProfile(userId, patch);
}
