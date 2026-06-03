"use client";

const PREVIEW_BANNER = (
  <div className="mb-5 flex items-center gap-2 rounded-[var(--radius-sm)] border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
    <span><strong>Preview</strong> — Inflation Intelligence is a planned feature. Data shown is illustrative.</span>
  </div>
);

const CATEGORIES = [
  { name: "Healthcare", share: 8, inflation: 5.2, severity: "high" },
  { name: "Groceries", share: 14, inflation: 4.1, severity: "high" },
  { name: "Housing", share: 28, inflation: 3.8, severity: "medium" },
  { name: "Transport", share: 12, inflation: 3.1, severity: "medium" },
  { name: "Dining Out", share: 11, inflation: 2.9, severity: "medium" },
  { name: "Entertainment", share: 7, inflation: 1.8, severity: "low" },
  { name: "Shopping", share: 10, inflation: 1.2, severity: "low" },
  { name: "Personal Care", share: 5, inflation: 0.9, severity: "low" },
  { name: "Utilities", share: 5, inflation: 4.8, severity: "high" },
];

const PERSONAL_RATE = 3.8; // weighted personal inflation rate
const NATIONAL_CPI = 3.1;
const SALARY_RAISE = 3.0;

function severityColor(s: string) {
  if (s === "high") return "#ef4444";
  if (s === "medium") return "#f59e0b";
  return "#22c55e";
}

export function InflationPanel() {
  const realSavingsRate = 5.2 - PERSONAL_RATE;

  return (
    <div className="space-y-5">
      {PREVIEW_BANNER}

      {/* Personal inflation hero */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div
          className="md:col-span-1 rounded-[var(--radius-lg)] p-5"
          style={{ background: "var(--gradient-hero)" }}
        >
          <p className="text-sm font-medium text-white/70">Your personal inflation rate</p>
          <p className="mt-1 text-5xl font-extrabold tracking-tight text-white">{PERSONAL_RATE}%</p>
          <p className="mt-2 text-sm text-white/70">
            vs. national CPI {NATIONAL_CPI}% — your lifestyle inflates faster than average
          </p>
        </div>
        <div className="md:col-span-2 grid grid-cols-2 gap-3">
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">Your raise this year</p>
            <p className="mt-0.5 text-2xl font-extrabold text-text">{SALARY_RAISE}%</p>
            <p className="mt-1 text-xs font-semibold text-danger">
              Real raise: −0.8% (you took a pay cut)
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">Real savings rate</p>
            <p className="mt-0.5 text-2xl font-extrabold text-text">{realSavingsRate.toFixed(1)}%</p>
            <p className="mt-1 text-xs text-text-muted">after {PERSONAL_RATE}% inflation</p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">Purchasing power loss</p>
            <p className="mt-0.5 text-2xl font-extrabold text-danger">−$1,240</p>
            <p className="mt-1 text-xs text-text-muted">since Jan 2024 on $80K salary</p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">Raise needed to break even</p>
            <p className="mt-0.5 text-2xl font-extrabold text-text">$2,720</p>
            <p className="mt-1 text-xs text-text-muted">at your personal inflation rate</p>
          </div>
        </div>
      </div>

      {/* Salary negotiation brief */}
      <div className="rounded-[var(--radius-md)] border border-primary/30 bg-primary/5 p-5">
        <div className="mb-2 flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-primary">
            <path d="M10.75 10.818v2.614A3.13 3.13 0 0011.888 13c.482-.315.612-.648.612-.875 0-.229-.13-.562-.612-.875a3.13 3.13 0 00-1.138-.432zM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 00-.35.13c-.14.065-.27.143-.386.233-.377.292-.514.627-.514.909 0 .184.058.39.33.585z"/>
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-6a.75.75 0 01.75.75v.316a3.78 3.78 0 011.653.713c.426.33.744.74.925 1.2a.75.75 0 01-1.395.55 1.35 1.35 0 00-.447-.563 2.187 2.187 0 00-.736-.363V9.3c.698.093 1.383.32 1.959.696.787.514 1.29 1.27 1.29 2.13 0 .86-.504 1.616-1.29 2.13-.576.377-1.261.603-1.96.696v.299a.75.75 0 11-1.5 0v-.3c-.697-.092-1.382-.318-1.958-.695-.482-.315-.857-.717-1.048-1.184a.75.75 0 111.39-.556c.08.204.234.4.522.587.325.201.7.333 1.094.macOS V8.2a3.78 3.78 0 01-1.653-.713C6.454 7.341 6 6.845 6 6.25c0-.595.454-1.09.847-1.39A3.78 3.78 0 019.25 4.316V4a.75.75 0 01.75-.75z" clipRule="evenodd"/>
          </svg>
          <p className="text-sm font-bold text-primary">Salary Negotiation Brief</p>
        </div>
        <div className="space-y-1 text-sm text-text">
          <p>Your personal inflation rate this year: <strong>{PERSONAL_RATE}%</strong></p>
          <p>Your raise: <strong>{SALARY_RAISE}%</strong> — that is a <strong className="text-danger">−0.8% real pay cut</strong></p>
          <p>To maintain purchasing power at $80K, you need: <strong className="text-primary">$82,720</strong></p>
          <p>To actually advance financially: <strong className="text-primary">$84,800+</strong> (5%+ real raise)</p>
        </div>
        <button className="mt-3 rounded-[var(--radius-sm)] bg-primary px-3 py-1.5 text-xs font-semibold text-white">
          Export this brief as PDF
        </button>
      </div>

      {/* Category inflation heatmap */}
      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Category inflation heatmap — your spending × inflation rate
        </p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {CATEGORIES.sort((a, b) => b.inflation - a.inflation).map((c) => (
            <div
              key={c.name}
              className="rounded-[var(--radius-md)] border bg-surface p-3"
              style={{ borderColor: severityColor(c.severity) + "40" }}
            >
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold text-text">{c.name}</p>
                <span
                  className="text-xs font-bold"
                  style={{ color: severityColor(c.severity) }}
                >
                  {c.inflation}%
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-text-muted">{c.share}% of budget</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(c.inflation / 6) * 100}%`, background: severityColor(c.severity) }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
