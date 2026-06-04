import type { User, UserProfilePatch, UserProfileResponse } from "@/types/api";

export const DEFAULT_USER_PROFILE_FIELDS: Omit<UserProfileResponse, "user"> = {
  currentAge: 35,
  isDefaultAge: true,
  householdSize: null,
  annualGrossIncome: null,
  targetRetirementAge: null,
  employmentStatus: null,
  riskTolerance: null,
  withdrawalRate: 4,
  realReturn: 6,
  hasLinkedAccounts: false,
  currentNetWorth: null,
  monthlySpend: null,
  monthlyInvest: null,
};

export function buildFallbackUserProfile(user: User | null): UserProfileResponse {
  return {
    user: user ?? {
      id: "",
      email: "",
      displayName: null,
      createdAt: new Date().toISOString(),
    },
    ...DEFAULT_USER_PROFILE_FIELDS,
  };
}

export function profileFromApi(
  data: UserProfileResponse | undefined,
  user: User | null,
): UserProfileResponse {
  if (data) return data;
  return buildFallbackUserProfile(user);
}

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalMoney(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number.parseFloat(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function validateProfileForm(state: {
  displayName: string;
  currentAge: string;
  householdSize: string;
  annualGrossIncome: string;
  targetRetirementAge: string;
  withdrawalRate: number;
  realReturn: number;
}): string | null {
  const name = state.displayName.trim();
  if (!name) return "Name is required.";

  const age = Number.parseInt(state.currentAge, 10);
  if (!Number.isFinite(age) || age < 18 || age > 100) {
    return "Age must be between 18 and 100.";
  }

  const household = parseOptionalInt(state.householdSize);
  if (household != null && (household < 1 || household > 20)) {
    return "Household size must be between 1 and 20, or left blank.";
  }

  const income = parseOptionalMoney(state.annualGrossIncome);
  if (income != null && (income < 0 || income > 50_000_000)) {
    return "Annual income must be between 0 and 50,000,000, or left blank.";
  }

  const targetAge = parseOptionalInt(state.targetRetirementAge);
  if (targetAge != null && (targetAge < 18 || targetAge > 100)) {
    return "Target retirement age must be between 18 and 100, or left blank.";
  }
  if (targetAge != null && targetAge < age) {
    return "Target retirement age must be your current age or later.";
  }

  if (!Number.isFinite(state.withdrawalRate) || state.withdrawalRate < 1 || state.withdrawalRate > 10) {
    return "Withdrawal rate must be between 1% and 10%.";
  }

  if (!Number.isFinite(state.realReturn) || state.realReturn < 0 || state.realReturn > 15) {
    return "Expected real return must be between 0% and 15%.";
  }

  return null;
}

export function profilePatchFromForm(state: {
  displayName: string;
  currentAge: string;
  householdSize: string;
  annualGrossIncome: string;
  targetRetirementAge: string;
  employmentStatus: string;
  riskTolerance: string;
  withdrawalRate: number;
  realReturn: number;
}): UserProfilePatch {
  const validationError = validateProfileForm(state);
  if (validationError) {
    throw new Error(validationError);
  }

  const parsedAge = Number.parseInt(state.currentAge, 10);
  const household = parseOptionalInt(state.householdSize);
  const income = parseOptionalMoney(state.annualGrossIncome);
  const targetAge = parseOptionalInt(state.targetRetirementAge);

  return {
    displayName: state.displayName.trim(),
    currentAge: parsedAge,
    householdSize: household,
    annualGrossIncome: income,
    targetRetirementAge: targetAge,
    employmentStatus:
      state.employmentStatus === ""
        ? null
        : (state.employmentStatus as UserProfilePatch["employmentStatus"]),
    riskTolerance:
      state.riskTolerance === ""
        ? null
        : (state.riskTolerance as UserProfilePatch["riskTolerance"]),
    withdrawalRate: state.withdrawalRate,
    realReturn: state.realReturn,
  };
}

export function formStateFromProfile(profile: UserProfileResponse) {
  return {
    displayName: profile.user.displayName?.trim() ?? "",
    email: profile.user.email,
    currentAge: String(profile.currentAge),
    householdSize:
      profile.householdSize != null ? String(profile.householdSize) : "",
    annualGrossIncome:
      profile.annualGrossIncome != null
        ? String(Math.round(Number.parseFloat(profile.annualGrossIncome)))
        : "",
    targetRetirementAge:
      profile.targetRetirementAge != null
        ? String(profile.targetRetirementAge)
        : "",
    employmentStatus: profile.employmentStatus ?? "",
    riskTolerance: profile.riskTolerance ?? "",
    withdrawalRate: profile.withdrawalRate,
    realReturn: profile.realReturn,
  };
}

export function clampWithdrawalRate(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  if (value > 10) return 10;
  return value;
}

export function clampRealReturn(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 15) return 15;
  return value;
}
