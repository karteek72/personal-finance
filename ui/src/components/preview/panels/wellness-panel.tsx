"use client";

import {
  FeatureEmptyState,
  FeaturePanelLoading,
} from "@/components/preview/feature-empty-state";
import { useFeaturePanelGate } from "@/components/preview/use-feature-panel-gate";
import { MetricLiveBadge } from "@/components/ui/metric-live-badge";
import { useWellness } from "@/hooks/use-features";

interface Dimension {
  name: string;
  score: number;
  weight: number;
  description: string;
  trend: string;
}

function shortMonth(month: string): string {
  const m = Number.parseInt(month.split("-")[1] ?? "", 10);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return Number.isFinite(m) && m >= 1 && m <= 12 ? (names[m - 1] as string) : month;
}

function scoreColor(s: number) {
  if (s >= 80) return "#22c55e";
  if (s >= 60) return "#f59e0b";
  return "#ef4444";
}

function scoreLabel(s: number) {
  if (s >= 85) return "Excellent";
  if (s >= 70) return "Good";
  if (s >= 55) return "Fair";
  return "Needs Work";
}

const SCORE_DOMAIN = 100;
const HISTORY_CHART_HEIGHT = 96;
const SCORE_BANDS = [55, 70, 85] as const;
const HISTORY_Y_TICKS = [0, 25, 50, 75, 100] as const;

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up")
    return (
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-success" aria-hidden>
        <path d="M4 11l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (trend === "down")
    return (
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-danger" aria-hidden>
        <path d="M4 5l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return <span className="h-3.5 w-3.5 text-text-muted">—</span>;
}

export function WellnessPanel() {
  const gate = useFeaturePanelGate("financial wellness");
  const { data, isLoading } = useWellness();

  if (!gate.ready) return gate.node;
  if (isLoading) return <FeaturePanelLoading />;

  const dimensions: Dimension[] = data?.dimensions ?? [];
  const history = (data?.history ?? []).map((h) => h.score);
  const months = (data?.history ?? []).map((h) => shortMonth(h.month));

  if (dimensions.length === 0 && history.length === 0) {
    return (
      <FeatureEmptyState feature="financial wellness" variant="insufficient-data" />
    );
  }

  const SCORE = data?.score ?? 0;
  const delta = data?.delta ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <MetricLiveBadge isLive={data?.isLive ?? false} />
      </div>

      {/* Score hero */}
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-6">
        <div className="flex flex-col items-center gap-4 md:flex-row md:gap-8">
          {/* Circle */}
          <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-border)" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke={scoreColor(SCORE)}
                strokeWidth="10"
                strokeDasharray={`${(SCORE / 100) * 327} 327`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-extrabold tabular-nums text-text">{SCORE}</span>
              <span className="text-xs font-semibold text-text-muted">{scoreLabel(SCORE)}</span>
            </div>
          </div>

          <div className="flex-1 text-center md:text-left">
            <p className="text-sm font-semibold text-text-muted">Financial wellness score</p>
            <p className="mt-1 text-2xl font-bold text-text">
              {delta >= 0 ? "+" : ""}
              {delta} pts vs last month
            </p>
            <p className="mt-2 text-xs text-text-muted">
              Composite of savings, debt, emergency fund, cash flow, inflation beat, investments, and goals.
            </p>
          </div>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <p className="mb-1 text-sm font-semibold text-text">Score history</p>
          <p className="mb-3 text-[11px] text-text-muted">
            Y-axis: 0–100 score · dashed lines at Fair (55), Good (70), Excellent (85)
          </p>
          <div className="flex gap-2">
            <div
              className="flex w-8 shrink-0 flex-col justify-between py-0.5 text-right text-[10px] tabular-nums text-text-muted"
              style={{ height: HISTORY_CHART_HEIGHT }}
            >
              {[...HISTORY_Y_TICKS].reverse().map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </div>
            <div className="relative min-w-0 flex-1">
              <div
                className="flex items-end gap-1.5"
                style={{ height: HISTORY_CHART_HEIGHT }}
              >
                {history.map((s, i) => {
                  const barHeight = Math.max((s / SCORE_DOMAIN) * HISTORY_CHART_HEIGHT, 2);
                  return (
                    <div
                      key={`${months[i]}-${i}`}
                      className="flex flex-1 flex-col items-center justify-end gap-0.5"
                      title={`${months[i]}: score ${s}`}
                    >
                      <span className="text-[9px] font-semibold tabular-nums text-text">{s}</span>
                      <div
                        className="w-full rounded-t-[var(--radius-xs)] bg-primary"
                        style={{ height: `${barHeight}px` }}
                        aria-label={`${months[i]} score ${s}`}
                      />
                    </div>
                  );
                })}
              </div>
              {SCORE_BANDS.map((band) => (
                <div
                  key={band}
                  className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-border/70"
                  style={{ bottom: `${(band / SCORE_DOMAIN) * HISTORY_CHART_HEIGHT}px` }}
                >
                  <span className="absolute -top-3.5 right-0 text-[9px] text-text-muted">{band}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 flex justify-between pl-10 text-[9px] text-text-muted">
            {months.map((mo, i) => (
              <span key={`${mo}-${i}`} className="flex-1 text-center">
                {mo}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dimensions */}
      {dimensions.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Score breakdown</p>
          {dimensions.map((d) => (
            <div key={d.name} className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-text">{d.name}</p>
                  <p className="text-xs text-text-muted">{d.description}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendIcon trend={d.trend} />
                  <span className="text-lg font-bold tabular-nums" style={{ color: scoreColor(d.score) }}>
                    {d.score}
                  </span>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${d.score}%`, background: scoreColor(d.score) }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
