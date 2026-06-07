"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { FeaturePanelLoading } from "@/components/preview/feature-empty-state";
import { usePatchUserProfile, useUserProfile } from "@/hooks/use-features";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  buildFallbackUserProfile,
  clampRealReturn,
  clampWithdrawalRate,
  formStateFromProfile,
  profileFromApi,
  profilePatchFromForm,
  validateProfileForm,
} from "@/lib/user-profile";
import type { EmploymentStatus, RiskTolerance } from "@/types/api";

const EMPLOYMENT_OPTIONS: { value: EmploymentStatus; label: string }[] = [
  { value: "employed", label: "Employed (W-2)" },
  { value: "self_employed", label: "Self-employed" },
  { value: "retired", label: "Retired" },
  { value: "student", label: "Student" },
  { value: "other", label: "Other" },
];

const RISK_OPTIONS: { value: RiskTolerance; label: string }[] = [
  { value: "conservative", label: "Conservative" },
  { value: "moderate", label: "Moderate" },
  { value: "aggressive", label: "Aggressive" },
];

function moneyLabel(value: string | null) {
  if (value == null) return "—";
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

const inputClass =
  "mt-1 block w-full rounded-[var(--radius-sm)] border border-border bg-background px-3 py-2 text-sm text-text";

export function ProfileView() {
  const authUser = useCurrentUser();
  const { data, isLoading, isError, error, refetch } = useUserProfile();
  const patchProfile = usePatchUserProfile();

  const profile = profileFromApi(data, authUser);
  const baselineProfile = data ?? buildFallbackUserProfile(authUser);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [currentAge, setCurrentAge] = useState("35");
  const [householdSize, setHouseholdSize] = useState("");
  const [annualGrossIncome, setAnnualGrossIncome] = useState("");
  const [targetRetirementAge, setTargetRetirementAge] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("");
  const [riskTolerance, setRiskTolerance] = useState("");
  const [withdrawalRate, setWithdrawalRate] = useState(4);
  const [realReturn, setRealReturn] = useState(6);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const source = data ?? buildFallbackUserProfile(authUser);
    const form = formStateFromProfile(source);
    setDisplayName(form.displayName || authUser?.displayName?.trim() || "");
    setEmail(form.email || authUser?.email || "");
    setCurrentAge(form.currentAge);
    setHouseholdSize(form.householdSize);
    setAnnualGrossIncome(form.annualGrossIncome);
    setTargetRetirementAge(form.targetRetirementAge);
    setEmploymentStatus(form.employmentStatus);
    setRiskTolerance(form.riskTolerance);
    setWithdrawalRate(form.withdrawalRate);
    setRealReturn(form.realReturn);
  }, [data, authUser]);

  const parsedAge = Number.parseInt(currentAge, 10);
  const canSave =
    displayName.trim().length > 0 &&
    Number.isFinite(parsedAge) &&
    parsedAge >= 18 &&
    parsedAge <= 100;

  const dirty = useMemo(() => {
    const baseline = formStateFromProfile(baselineProfile);
    if (authUser && !data) {
      baseline.displayName = authUser.displayName?.trim() ?? baseline.displayName;
      baseline.email = authUser.email;
    }
    return (
      displayName.trim() !== baseline.displayName ||
      currentAge !== baseline.currentAge ||
      householdSize !== baseline.householdSize ||
      annualGrossIncome !== baseline.annualGrossIncome ||
      targetRetirementAge !== baseline.targetRetirementAge ||
      employmentStatus !== baseline.employmentStatus ||
      riskTolerance !== baseline.riskTolerance ||
      withdrawalRate !== baseline.withdrawalRate ||
      realReturn !== baseline.realReturn
    );
  }, [
    baselineProfile,
    authUser,
    data,
    displayName,
    currentAge,
    householdSize,
    annualGrossIncome,
    targetRetirementAge,
    employmentStatus,
    riskTolerance,
    withdrawalRate,
    realReturn,
  ]);

  async function handleSave() {
    setSaveError(null);
    const formState = {
      displayName,
      currentAge,
      householdSize,
      annualGrossIncome,
      targetRetirementAge,
      employmentStatus,
      riskTolerance,
      withdrawalRate,
      realReturn,
    };
    const clientError = validateProfileForm(formState);
    if (clientError) {
      setSaveError(clientError);
      return;
    }
    try {
      await patchProfile.mutateAsync(profilePatchFromForm(formState));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save profile.");
    }
  }

  if (isLoading && !data) {
    return <FeaturePanelLoading />;
  }

  const loadFailed = isError && !data;
  const errorMessage =
    error instanceof Error ? error.message : "Could not load saved profile";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-text">Profile</h1>
        <p className="mt-1 text-sm text-text-muted">
          Your identity and planning assumptions. These improve FIRE timelines,
          wellness scores, savings-rate context, and household-aware insights.
        </p>
      </div>

      {loadFailed ? (
        <div className="rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text">
          <strong>Saved settings could not be loaded</strong> ({errorMessage}).
          You can still edit below — click Save to store them. If this persists,
          restart the API and run database migrations{" "}
          <code className="text-xs">0013</code> and <code className="text-xs">0014</code>.
          <button
            type="button"
            onClick={() => void refetch()}
            className="ml-2 font-semibold text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      {profile.isDefaultAge ? (
        <div className="rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text">
          <strong>Set your age</strong> — analytics still use the default (35)
          until you save your profile.
        </div>
      ) : null}

      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
        <p className="text-sm font-bold text-text">About you</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-text-muted">Name</span>
            <input
              type="text"
              maxLength={100}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-text-muted">Email</span>
            <input
              type="email"
              value={email}
              readOnly
              className={`${inputClass} cursor-not-allowed opacity-70`}
            />
            <span className="mt-1 block text-[11px] text-text-muted">
              From Google sign-in (read-only).
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-text-muted">
              Current age
            </span>
            <input
              type="number"
              min={18}
              max={100}
              value={currentAge}
              onChange={(e) => setCurrentAge(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-text-muted">
              Household size
            </span>
            <input
              type="number"
              min={1}
              max={20}
              value={householdSize}
              onChange={(e) => setHouseholdSize(e.target.value)}
              placeholder="e.g. 2"
              className={inputClass}
            />
            <span className="mt-1 block text-[11px] text-text-muted">
              People you support on this budget (optional).
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-text-muted">
              Employment
            </span>
            <select
              value={employmentStatus}
              onChange={(e) => setEmploymentStatus(e.target.value)}
              className={inputClass}
            >
              <option value="">Not set</option>
              {EMPLOYMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-text-muted">
              Annual gross income (USD)
            </span>
            <input
              type="number"
              min={0}
              step={1000}
              value={annualGrossIncome}
              onChange={(e) => setAnnualGrossIncome(e.target.value)}
              placeholder="Optional"
              className={inputClass}
            />
            <span className="mt-1 block text-[11px] text-text-muted">
              Helps savings-rate and income-based KPIs (not synced from banks).
            </span>
          </label>
        </div>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
        <p className="text-sm font-bold text-text">Planning & investing</p>
        <p className="mt-1 text-xs text-text-muted">
          Used for FIRE, portfolio projections, and risk-aware insights.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-text-muted">
              Target retirement age
            </span>
            <input
              type="number"
              min={18}
              max={100}
              value={targetRetirementAge}
              onChange={(e) => setTargetRetirementAge(e.target.value)}
              placeholder="Optional"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-text-muted">
              Risk tolerance
            </span>
            <select
              value={riskTolerance}
              onChange={(e) => setRiskTolerance(e.target.value)}
              className={inputClass}
            >
              <option value="">Not set</option>
              {RISK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-text-muted">
              Safe withdrawal rate (%)
            </span>
            <input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={withdrawalRate}
              onChange={(e) =>
                setWithdrawalRate(clampWithdrawalRate(Number(e.target.value)))
              }
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-text-muted">
              Expected real return (% / year)
            </span>
            <input
              type="number"
              min={0}
              max={15}
              step={0.5}
              value={realReturn}
              onChange={(e) =>
                setRealReturn(clampRealReturn(Number(e.target.value)))
              }
              className={inputClass}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!dirty || !canSave || patchProfile.isPending}
            onClick={() => void handleSave()}
            className="rounded-[var(--radius-sm)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {patchProfile.isPending ? "Saving…" : "Save profile"}
          </button>
          {saved ? (
            <span className="text-sm font-medium text-success">Saved</span>
          ) : null}
          {saveError ? (
            <span className="text-sm text-danger">{saveError}</span>
          ) : null}
        </div>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
        <p className="text-sm font-bold text-text">From linked accounts</p>
        <p className="mt-1 text-xs text-text-muted">
          Auto-updated from banks and brokerages (~last 3 months).{" "}
          <Link href="/accounts" className="font-semibold text-primary hover:underline">
            Connect accounts
          </Link>
        </p>

        {!profile.hasLinkedAccounts ? (
          <p className="mt-3 text-sm text-text-muted">
            No linked accounts yet — net worth and spend averages appear here
            after you connect.
          </p>
        ) : (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Net worth
              </dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums text-text">
                {moneyLabel(profile.currentNetWorth)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Avg monthly spend
              </dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums text-text">
                {moneyLabel(profile.monthlySpend)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Avg monthly investing
              </dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums text-text">
                {moneyLabel(profile.monthlyInvest)}
              </dd>
            </div>
          </dl>
        )}

        <p className="mt-4 text-xs text-text-muted">
          FIRE projection:{" "}
          <Link href="/wealth" className="font-semibold text-primary hover:underline">
            Wealth → FIRE
          </Link>
        </p>
      </div>
    </div>
  );
}
