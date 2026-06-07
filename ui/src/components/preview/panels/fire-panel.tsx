"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  FeatureEmptyState,
  FeaturePanelLoading,
} from "@/components/preview/feature-empty-state";
import { useFeaturePanelGate } from "@/components/preview/use-feature-panel-gate";
import { useFire } from "@/hooks/use-features";

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function compactMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}k`;
  return money(n);
}

const CHART_HEIGHT = 140;

export function FirePanel() {
  const gate = useFeaturePanelGate("FIRE projection");

  const [monthlySpend, setMonthlySpend] = useState(4200);
  const [monthlyInvest, setMonthlyInvest] = useState(2100);
  const [withdrawalRate, setWithdrawalRate] = useState(4);
  const [realReturn, setRealReturn] = useState(6);

  const { data: fire, isLoading, isError } = useFire({
    monthlySpend,
    monthlyInvest,
    withdrawalRate,
    realReturn,
  });

  const { data: investMoreFire } = useFire({
    monthlySpend,
    monthlyInvest: monthlyInvest + 300,
    withdrawalRate,
    realReturn,
  });
  const { data: spendLessFire } = useFire({
    monthlySpend: Math.max(monthlySpend - 400, 0),
    monthlyInvest,
    withdrawalRate,
    realReturn,
  });

  const seeded = useRef(false);
  useEffect(() => {
    if (fire && !seeded.current) {
      seeded.current = true;
      setMonthlySpend(Math.round(Number.parseFloat(fire.monthlySpend)));
      setMonthlyInvest(Math.round(Number.parseFloat(fire.monthlyInvest)));
      setWithdrawalRate(fire.withdrawalRate);
      setRealReturn(fire.realReturn);
    }
  }, [fire]);

  const currentAge = fire?.currentAge ?? 35;
  const projection = fire?.projection;
  const fireNumber = projection
    ? Number.parseFloat(projection.fireNumber)
    : 0;
  const years = projection?.yearsToFire ?? 0;
  const fireAge = projection?.fireAge ?? currentAge;
  const investingRate = projection?.investingRate ?? 0;
  const curve = projection?.curve ?? [];

  const maxVal = Math.max(...curve, fireNumber);

  const yTicks = useMemo(() => {
    const top = maxVal;
    return [0, top / 2, top].map((v) => Math.round(v));
  }, [maxVal]);

  const xLabels = useMemo(() => {
    if (curve.length === 0) return [];
    const indices =
      curve.length <= 4
        ? curve.map((_, i) => i)
        : [0, Math.floor(curve.length / 2), curve.length - 1];
    return indices.map((i) => ({
      i,
      age: Math.round(currentAge + i),
      balance: curve[i] ?? 0,
    }));
  }, [curve, currentAge]);

  if (!gate.ready) return gate.node;
  if (isLoading) return <FeaturePanelLoading />;
  if (isError || !fire) {
    return (
      <FeatureEmptyState
        feature="FIRE projection"
        variant="insufficient-data"
      />
    );
  }

  return (
    <div className="space-y-5">
      {fire.isDefaultAge ? (
        <div className="rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text">
          <strong>Age 35 is a placeholder.</strong>{" "}
          <Link href="/profile" className="font-semibold text-primary hover:underline">
            Set your age in Profile
          </Link>{" "}
          so FIRE Age and the chart timeline are accurate.
        </div>
      ) : null}

      <p className="text-xs text-text-muted">
        Using Age <strong className="text-text">{currentAge}</strong>, withdrawal{" "}
        {withdrawalRate}%, and {realReturn}% real return from your{" "}
        <Link href="/profile" className="font-semibold text-primary hover:underline">
          analytics profile
        </Link>
        . Sliders below are local what-if only.
      </p>

      <div
        className="rounded-[var(--radius-lg)] p-5"
        style={{ background: "var(--gradient-hero)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
          You can reach financial independence at
        </p>
        <p className="mt-1 text-5xl font-extrabold text-white tabular-nums">
          Age {fireAge.toFixed(0)}
        </p>
        <p className="mt-1 text-sm text-white/70">
          That&apos;s <strong>{years.toFixed(1)} years</strong> from now. Your
          FIRE number is <strong>{money(fireNumber)}</strong> — annual spending{" "}
          {money(monthlySpend * 12)} divided by a {withdrawalRate}% safe
          withdrawal rate.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
            Investing rate {investingRate}%
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
            FIRE number {money(fireNumber)}
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
            {years.toFixed(0)} yrs to go
          </span>
        </div>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
        <p className="text-sm font-bold text-text">Projected portfolio growth</p>
        <p className="mt-1 text-xs text-text-muted">
          Each bar is year-end balance: start at today&apos;s net worth, then each
          month apply {(realReturn).toFixed(1)}% real return (÷12) and add{" "}
          {money(monthlyInvest)}. Green bars cross the dashed FIRE target (
          {money(fireNumber)}).
        </p>
        <div className="mt-3 flex gap-2">
          <div
            className="flex w-12 shrink-0 flex-col justify-between py-0.5 text-right text-[10px] tabular-nums text-text-muted"
            style={{ height: CHART_HEIGHT }}
          >
            {[...yTicks].reverse().map((tick) => (
              <span key={tick}>{compactMoney(tick)}</span>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            <div
              className="flex items-end gap-0.5"
              style={{ height: CHART_HEIGHT }}
            >
              {curve.map((v, i) => {
                const reached = v >= fireNumber;
                const h = Math.max((v / maxVal) * CHART_HEIGHT, 2);
                return (
                  <div
                    key={i}
                    className="flex flex-1 flex-col justify-end"
                    title={`Age ${currentAge + i}: ${money(v)}`}
                  >
                    <div
                      className="w-full rounded-t-[var(--radius-xs)]"
                      style={{
                        height: `${h}px`,
                        background: reached
                          ? "#22c55e"
                          : "var(--color-primary)",
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div
              className="pointer-events-none absolute left-0 right-0 border-t-2 border-dashed border-success/70"
              style={{ bottom: `${(fireNumber / maxVal) * CHART_HEIGHT}px` }}
            >
              <span className="absolute -top-4 right-0 rounded bg-success/10 px-1.5 text-[10px] font-semibold text-success">
                FIRE {compactMoney(fireNumber)}
              </span>
            </div>
            {[0, 0.5, 1].map((frac) => (
              <div
                key={frac}
                className="pointer-events-none absolute left-0 right-0 border-t border-border/40"
                style={{ bottom: `${frac * CHART_HEIGHT}px` }}
              />
            ))}
          </div>
        </div>
        <div className="mt-2 flex justify-between pl-14 text-[10px] tabular-nums text-text-muted">
          {xLabels.map(({ i, age, balance }) => (
            <span key={i} className="text-center">
              Age {age}
              <span className="block text-[9px] opacity-80">
                {compactMoney(balance)}
              </span>
            </span>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-text-muted">
          <span className="font-semibold text-text">Y-axis:</span> portfolio
          value · <span className="font-semibold text-text">X-axis:</span> Age
          (one bar per year)
        </p>
      </div>

      <details className="rounded-[var(--radius-md)] border border-border bg-surface p-4 text-sm text-text-muted">
        <summary className="cursor-pointer font-bold text-text">
          How the projection works
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong className="text-text">FIRE number</strong> = (monthly
            retirement spending × 12) ÷ (withdrawal rate ÷ 100). Example:{" "}
            {money(monthlySpend)}/mo at {withdrawalRate}% → {money(fireNumber)}.
          </li>
          <li>
            <strong className="text-text">Years to FIRE</strong> = months until
            simulated balance (net worth today, monthly compounding at real
            return, plus monthly investing) reaches the FIRE number.
          </li>
          <li>
            <strong className="text-text">FIRE Age</strong> = current Age +
            years to FIRE.
          </li>
          <li>
            Sliders adjust the model locally; save age, withdrawal rate, and
            return assumptions on your{" "}
            <Link href="/profile" className="font-semibold text-primary hover:underline">
              Profile
            </Link>{" "}
            page.
          </li>
        </ul>
      </details>

      <div className="grid gap-3 md:grid-cols-2">
        {[
          {
            label: "Monthly spending in retirement",
            value: monthlySpend,
            set: setMonthlySpend,
            min: 2000,
            max: 9000,
            step: 100,
            fmt: money,
          },
          {
            label: "Monthly investing now",
            value: monthlyInvest,
            set: setMonthlyInvest,
            min: 200,
            max: 6000,
            step: 100,
            fmt: money,
          },
          {
            label: "Safe withdrawal rate",
            value: withdrawalRate,
            set: setWithdrawalRate,
            min: 3,
            max: 6,
            step: 0.5,
            fmt: (n: number) => `${n}%`,
          },
          {
            label: "Expected real return",
            value: realReturn,
            set: setRealReturn,
            min: 3,
            max: 9,
            step: 0.5,
            fmt: (n: number) => `${n}%`,
          },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-[var(--radius-md)] border border-border bg-surface p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold text-text">
                {c.label}
              </label>
              <span className="text-sm font-bold tabular-nums text-primary">
                {c.fmt(c.value)}
              </span>
            </div>
            <input
              type="range"
              min={c.min}
              max={c.max}
              step={c.step}
              value={c.value}
              onChange={(e) => c.set(Number(e.target.value))}
              className="w-full accent-[var(--color-primary)]"
            />
          </div>
        ))}
      </div>

      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-bold text-text">Accelerators</p>
        <div className="space-y-2 text-sm">
          {[
            {
              label: "Invest $300/mo more",
              delta: investMoreFire?.projection.yearsToFire ?? years,
            },
            {
              label: "Cut $400/mo of spending (lowers FIRE number too)",
              delta: spendLessFire?.projection.yearsToFire ?? years,
            },
          ].map((row) => {
            const saved = years - row.delta;
            return (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-[var(--radius-sm)] border border-border px-3 py-2"
              >
                <span className="text-text">{row.label}</span>
                <span className="font-semibold text-success">
                  −{saved.toFixed(1)} yrs → Age{" "}
                  {(currentAge + row.delta).toFixed(0)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
