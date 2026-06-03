"use client";

const PREVIEW_BANNER = (
  <div className="mb-5 flex items-center gap-2 rounded-[var(--radius-sm)] border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
    <span><strong>Preview</strong> — Net Worth Tracker is a planned feature. Data shown is illustrative.</span>
  </div>
);

const ASSETS = [
  { name: "Chase Checking", type: "Cash", value: 8420, color: "#22c55e" },
  { name: "Chase Savings", type: "Cash", value: 14230, color: "#22c55e" },
  { name: "Robinhood Portfolio", type: "Investments", value: 23870, color: "#3b82f6" },
  { name: "401(k) Fidelity", type: "Retirement", value: 41200, color: "#a855f7" },
  { name: "Roth IRA", type: "Retirement", value: 12450, color: "#a855f7" },
];

const LIABILITIES = [
  { name: "Chase Sapphire", type: "Credit Card", value: 2340, color: "#ef4444" },
  { name: "Amazon Visa", type: "Credit Card", value: 870, color: "#ef4444" },
  { name: "Student Loan", type: "Loan", value: 18500, color: "#f97316" },
];

const HISTORY = [
  { month: "Oct", value: 62000 },
  { month: "Nov", value: 64200 },
  { month: "Dec", value: 63800 },
  { month: "Jan", value: 67100 },
  { month: "Feb", value: 69500 },
  { month: "Mar", value: 71200 },
  { month: "Apr", value: 74800 },
  { month: "May", value: 76460 },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function NetWorthPage() {
  const totalAssets = ASSETS.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = LIABILITIES.reduce((s, l) => s + l.value, 0);
  const netWorth = totalAssets - totalLiabilities;
  const prevNetWorth = HISTORY[HISTORY.length - 2]?.value ?? netWorth;
  const change = netWorth - prevNetWorth;
  const changePct = ((change / prevNetWorth) * 100).toFixed(1);

  const minVal = Math.min(...HISTORY.map((h) => h.value));
  const maxVal = Math.max(...HISTORY.map((h) => h.value));
  const range = maxVal - minVal;

  return (
    <div className="space-y-5">
      {PREVIEW_BANNER}

      {/* Hero */}
      <div
        className="rounded-[var(--radius-lg)] p-6"
        style={{ background: "var(--gradient-hero)" }}
      >
        <p className="text-sm font-medium text-white/70">Net Worth</p>
        <p className="mt-1 text-5xl font-extrabold tracking-tight text-white">{fmt(netWorth)}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
            +{fmt(change)} this month
          </span>
          <span className="text-sm text-white/70">({changePct}%)</span>
        </div>
        <div className="mt-4 flex gap-6">
          <div>
            <p className="text-xs text-white/60">Total assets</p>
            <p className="text-sm font-bold text-white">{fmt(totalAssets)}</p>
          </div>
          <div>
            <p className="text-xs text-white/60">Total debt</p>
            <p className="text-sm font-bold text-white">{fmt(totalLiabilities)}</p>
          </div>
          <div>
            <p className="text-xs text-white/60">Projected $100K</p>
            <p className="text-sm font-bold text-white">14 months</p>
          </div>
        </div>
      </div>

      {/* Trend chart */}
      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-semibold text-text">Net worth trend — last 8 months</p>
        <div className="flex h-24 items-end gap-2">
          {HISTORY.map((h, i) => {
            const heightPct = range === 0 ? 50 : ((h.value - minVal) / range) * 80 + 10;
            const isLatest = i === HISTORY.length - 1;
            return (
              <div key={h.month} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-[var(--radius-xs)] transition-all"
                  style={{
                    height: `${heightPct}px`,
                    background: isLatest ? "var(--color-primary)" : "var(--color-border)",
                  }}
                />
                <span className="text-[9px] text-text-muted">{h.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Assets */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Assets</p>
          <p className="text-xs font-bold text-success">{fmt(totalAssets)}</p>
        </div>
        {ASSETS.map((a) => (
          <div
            key={a.name}
            className="flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
              <div>
                <p className="text-sm font-semibold text-text">{a.name}</p>
                <p className="text-xs text-text-muted">{a.type}</p>
              </div>
            </div>
            <p className="text-sm font-bold text-text">{fmt(a.value)}</p>
          </div>
        ))}
      </div>

      {/* Liabilities */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Liabilities</p>
          <p className="text-xs font-bold text-danger">−{fmt(totalLiabilities)}</p>
        </div>
        {LIABILITIES.map((l) => (
          <div
            key={l.name}
            className="flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
              <div>
                <p className="text-sm font-semibold text-text">{l.name}</p>
                <p className="text-xs text-text-muted">{l.type}</p>
              </div>
            </div>
            <p className="text-sm font-bold text-danger">−{fmt(l.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
