"use client";

import { useWellness } from "@/hooks/use-features";

interface Dimension {
  name: string;
  score: number;
  weight: number;
  description: string;
  trend: string;
}

const FALLBACK_SCORE = 72;
const FALLBACK_DELTA = 4;

const FALLBACK_DIMENSIONS: Dimension[] = [
  { name: "Savings Rate", score: 78, weight: 20, description: "You save 18% of income. Target: 20%+", trend: "up" },
  { name: "Debt Health", score: 61, weight: 20, description: "Credit utilization at 34%. Target: <30%", trend: "down" },
  { name: "Emergency Fund", score: 64, weight: 15, description: "6.4 months covered. Target: 6+ months", trend: "up" },
  { name: "Income-to-Expense", score: 82, weight: 20, description: "Expenses are 72% of income", trend: "up" },
  { name: "Inflation Beat", score: 55, weight: 10, description: "Real savings rate: 1.2% after inflation", trend: "neutral" },
  { name: "Investment Growth", score: 70, weight: 10, description: "Portfolio up 12.4% YTD", trend: "up" },
  { name: "Goal Pace", score: 88, weight: 5, description: "3/3 goals on track", trend: "up" },
];

const FALLBACK_HISTORY = [60, 63, 61, 65, 68, 67, 70, 72];
const FALLBACK_MONTHS = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"];

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
  const { data } = useWellness();

  const SCORE = data?.score ?? FALLBACK_SCORE;
  const delta = data?.delta ?? FALLBACK_DELTA;
  const dimensions: Dimension[] = data?.dimensions.length ? data.dimensions : FALLBACK_DIMENSIONS;
  const history = data?.history.length
    ? data.history.map((h) => h.score)
    : FALLBACK_HISTORY;
  const months = data?.history.length
    ? data.history.map((h) => shortMonth(h.month))
    : FALLBACK_MONTHS;
  const maxBar = Math.max(...history);

  return (
    <div className="space-y-5">

      {/* Score hero */}
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-6">
        <div className="flex flex-col items-center gap-4 md:flex-row md:gap-8">
          {/* Circle */}
          <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-border)" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke={scoreColor(SCORE)}
                strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - SCORE / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-extrabold text-text" style={{ color: scoreColor(SCORE) }}>
                {SCORE}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                {scoreLabel(SCORE)}
              </span>
            </div>
          </div>

          {/* Summary */}
          <div className="flex-1">
            <h2 className="text-xl font-bold text-text">Financial Wellness Score</h2>
            <p className="mt-1 text-sm text-text-muted">
              Your score {delta >= 0 ? "improved" : "dropped"}{" "}
              <strong className={delta >= 0 ? "text-success" : "text-danger"}>
                {delta >= 0 ? "+" : ""}{delta} point{Math.abs(delta) === 1 ? "" : "s"}
              </strong>{" "}
              since last month. Top opportunity: reduce credit card utilization below 30%.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                Goal pace: on track
              </span>
              <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
                Debt: needs attention
              </span>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Savings: solid
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Trend mini chart */}
      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-semibold text-text">Score history — last 8 months</p>
        <div className="flex h-16 items-end gap-1.5">
          {history.map((v, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-[var(--radius-xs)] transition-all"
                style={{
                  height: `${(v / maxBar) * 56}px`,
                  background: i === history.length - 1 ? scoreColor(SCORE) : "var(--color-border)",
                }}
              />
              <span className="text-[9px] text-text-muted">{months[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dimensions breakdown */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide px-1">
          Score breakdown
        </h3>
        {dimensions.map((d) => (
          <div
            key={d.name}
            className="rounded-[var(--radius-md)] border border-border bg-surface p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendIcon trend={d.trend} />
                <span className="text-sm font-semibold text-text">{d.name}</span>
                <span className="text-[10px] text-text-muted">({d.weight}% weight)</span>
              </div>
              <span
                className="text-sm font-bold"
                style={{ color: scoreColor(d.score) }}
              >
                {d.score}/100
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full"
                style={{ width: `${d.score}%`, background: scoreColor(d.score) }}
              />
            </div>
            <p className="mt-1.5 text-xs text-text-muted">{d.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
