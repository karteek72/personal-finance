"use client";

import { useMemo, useState } from "react";

import {
  FeatureEmptyState,
  FeaturePanelLoading,
} from "@/components/preview/feature-empty-state";
import { useRecurring } from "@/hooks/use-features";
import { formatMoney } from "@/lib/format-money";
import type { CostAudit } from "@/types/api";

interface Fee {
  id: string;
  label: string;
  source: string;
  count: number;
  total: number;
  fixable: boolean;
}

const AUDIT_PAGE_SIZE = 8;

function confidenceBadge(confidence: number): string {
  if (confidence >= 0.75) return "High impact";
  if (confidence >= 0.5) return "Medium impact";
  return "Lower confidence";
}

function AuditCard({ audit }: { audit: CostAudit }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text">
            {audit.emoji} {audit.title}
          </p>
          <p className="mt-1 text-xs text-text-muted">{audit.rationale}</p>
        </div>
        <span className="shrink-0 rounded-full bg-bg px-2 py-0.5 text-[10px] font-semibold text-text-muted">
          {confidenceBadge(audit.confidence)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-[var(--radius-sm)] bg-bg p-2">
          <p className="text-[10px] text-text-muted">Monthly</p>
          <p className="text-sm font-bold tabular-nums text-text">
            {formatMoney(audit.monthly)}
          </p>
        </div>
        <div className="rounded-[var(--radius-sm)] bg-bg p-2">
          <p className="text-[10px] text-text-muted">Annual</p>
          <p className="text-sm font-bold tabular-nums text-text">
            {formatMoney(audit.annual)}
          </p>
        </div>
        <div className="rounded-[var(--radius-sm)] bg-bg p-2">
          <p className="text-[10px] text-text-muted">10y opportunity</p>
          <p className="text-sm font-bold tabular-nums text-warning">
            {formatMoney(audit.opportunityCost10y)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-success/5 px-3 py-2">
        <p className="text-[12px] text-text">{audit.action}</p>
        <p className="shrink-0 text-xs font-bold tabular-nums text-success">
          Save ~{formatMoney(audit.savingsEstimate)}/mo
        </p>
      </div>
    </div>
  );
}

function LapsedSubscriptionCard({
  audit,
  onConfirm,
}: {
  audit: CostAudit;
  onConfirm: (id: string) => void;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-success/40 bg-success/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-text">
            {audit.emoji} {audit.title}
          </p>
          <p className="mt-1 text-xs text-text-muted">{audit.rationale}</p>
          <p className="mt-2 text-sm text-text">
            Saving about{" "}
            <strong className="tabular-nums text-success">
              {formatMoney(audit.annual)}/yr
            </strong>{" "}
            if this subscription is cancelled.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onConfirm(audit.id)}
          className="flex-1 rounded-[var(--radius-sm)] bg-success px-3 py-2 text-xs font-semibold text-white"
        >
          Yes, looks cancelled
        </button>
        <button
          type="button"
          onClick={() => onConfirm(audit.id)}
          className="rounded-[var(--radius-sm)] border border-border px-3 py-2 text-xs font-semibold text-text-muted hover:text-text"
        >
          Still active
        </button>
      </div>
    </div>
  );
}

export function LeaksPanel() {
  const [tab, setTab] = useState<"fees" | "audit">("fees");
  const [auditPage, setAuditPage] = useState(1);
  const [dismissedLapsed, setDismissedLapsed] = useState<Set<string>>(new Set());
  const { data, isLoading } = useRecurring();

  const fees: Fee[] = useMemo(
    () =>
      (data?.leaks.fees ?? []).map((f) => ({
        id: f.id,
        label: f.label,
        source: f.source,
        count: f.count,
        total: Number.parseFloat(f.total),
        fixable: f.fixable,
      })),
    [data?.leaks.fees],
  );

  const audits = data?.leaks.audits ?? [];
  const lapsedAudits = useMemo(
    () =>
      audits.filter(
        (a) => a.type === "lapsed_subscription" && !dismissedLapsed.has(a.id),
      ),
    [audits, dismissedLapsed],
  );
  const lifestyleAudits = useMemo(
    () => audits.filter((a) => a.type !== "lapsed_subscription"),
    [audits],
  );

  const visibleAuditCount = auditPage * AUDIT_PAGE_SIZE;
  const pagedAudits = lifestyleAudits.slice(0, visibleAuditCount);
  const hasMoreAudits = lifestyleAudits.length > visibleAuditCount;

  if (isLoading) {
    return <FeaturePanelLoading />;
  }

  const feeTotal = fees.reduce((s, f) => s + f.total, 0);
  const recoverable = fees.filter((f) => f.fixable).reduce((s, f) => s + f.total, 0);

  if (fees.length === 0 && audits.length === 0) {
    return (
      <FeatureEmptyState feature="money leaks" variant="insufficient-data" />
    );
  }

  const confirmLapsed = (id: string) => {
    setDismissedLapsed((prev) => new Set(prev).add(id));
  };

  return (
    <div className="space-y-5">
      <div
        className="rounded-[var(--radius-lg)] p-5"
        style={{ background: "var(--gradient-hero)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
          Silently draining your accounts
        </p>
        <p className="mt-1 text-5xl font-extrabold text-white tabular-nums">
          {formatMoney(String(feeTotal))}
        </p>
        <p className="mt-1 text-sm text-white/70">
          In fees over the last 12 months.{" "}
          <strong>{formatMoney(String(recoverable))}</strong> of that is avoidable
          with a few account changes.
        </p>
      </div>

      <div className="flex gap-2">
        {[
          { id: "fees" as const, label: "Hidden fees" },
          { id: "audit" as const, label: "Lifestyle cost audit" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-all ${
              tab === t.id
                ? "border-primary bg-primary-soft text-primary"
                : "border-border text-text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "fees" ? (
        <div className="space-y-2">
          {fees.map((f) => (
            <div
              key={f.id}
              className="rounded-[var(--radius-md)] border border-border bg-surface p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text">{f.label}</p>
                  <p className="text-[11px] text-text-muted">
                    {f.source} · {f.count}× this year
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold tabular-nums text-danger">
                    {formatMoney(String(f.total))}
                  </p>
                  {f.fixable ? (
                    <span className="text-[10px] font-semibold text-success">
                      Avoidable
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-text-muted">
                      Reduce balance
                    </span>
                  )}
                </div>
              </div>
              {f.fixable ? (
                <div className="mt-2 rounded-[var(--radius-sm)] bg-success/5 px-3 py-1.5 text-[12px] text-text">
                  {f.id === "atm" &&
                    "💡 Switch to a fee-free online bank or use in-network ATMs."}
                  {f.id === "overdraft" &&
                    "💡 Enable balance alerts at $100 + link a savings buffer."}
                  {f.id === "maint" &&
                    "💡 You qualify for a no-fee account with direct deposit."}
                  {f.id === "late" &&
                    "💡 Set autopay for the statement minimum to never miss again."}
                  {f.id === "fx" &&
                    "💡 Use a no-FX-fee travel card abroad."}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {lapsedAudits.length > 0 ? (
            <div className="space-y-2">
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Possibly cancelled subscriptions
              </p>
              {lapsedAudits.map((audit) => (
                <LapsedSubscriptionCard
                  key={audit.id}
                  audit={audit}
                  onConfirm={confirmLapsed}
                />
              ))}
            </div>
          ) : null}

          <div className="space-y-3">
            <p className="px-1 text-[11px] text-text-muted">
              Ranked by estimated savings. Opportunity cost is computed from your
              data — not a client-side estimate.
            </p>
            {lifestyleAudits.length === 0 ? (
              <p className="px-1 text-xs text-text-muted">
                No lifestyle audits detected yet.
              </p>
            ) : null}
            {pagedAudits.map((audit) => (
              <AuditCard key={audit.id} audit={audit} />
            ))}
            {hasMoreAudits ? (
              <button
                type="button"
                onClick={() => setAuditPage((p) => p + 1)}
                className="w-full rounded-[var(--radius-md)] border border-border py-2.5 text-sm font-semibold text-primary hover:bg-primary-soft/30"
              >
                Show more ({lifestyleAudits.length - visibleAuditCount} remaining)
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
