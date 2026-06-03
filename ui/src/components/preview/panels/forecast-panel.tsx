"use client";

import { useState } from "react";

const PREVIEW_BANNER = (
  <div className="mb-5 flex items-center gap-2 rounded-[var(--radius-sm)] border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
    <span><strong>Preview</strong> — Financial Weather Forecast is a planned feature. Data shown is illustrative.</span>
  </div>
);

type Weather = "sunny" | "partly" | "cloudy" | "stormy";

interface DayForecast {
  date: string;
  weekday: string;
  weather: Weather;
  projectedBalance: number;
  note: string;
}

const WEATHER_META: Record<Weather, { icon: string; label: string; color: string; bg: string }> = {
  sunny: { icon: "☀️", label: "Sunny", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  partly: { icon: "⛅", label: "Partly cloudy", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  cloudy: { icon: "☁️", label: "Cloudy", color: "#94a3b8", bg: "rgba(148,163,184,0.14)" },
  stormy: { icon: "⛈️", label: "Stormy", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

const FORECAST: DayForecast[] = [
  { date: "Jun 3", weekday: "Tue", weather: "sunny", projectedBalance: 4120, note: "No bills. Spending pace healthy." },
  { date: "Jun 4", weekday: "Wed", weather: "sunny", projectedBalance: 4060, note: "Clear skies." },
  { date: "Jun 5", weekday: "Thu", weather: "partly", projectedBalance: 3910, note: "iCloud + grocery run expected." },
  { date: "Jun 6", weekday: "Fri", weather: "cloudy", projectedBalance: 3640, note: "Weekend spending typically spikes." },
  { date: "Jun 7", weekday: "Sat", weather: "stormy", projectedBalance: 3180, note: "Electricity bill + dining surge risk." },
  { date: "Jun 8", weekday: "Sun", weather: "cloudy", projectedBalance: 3010, note: "Recovery, but tight." },
  { date: "Jun 9", weekday: "Mon", weather: "partly", projectedBalance: 2980, note: "Stabilizing before payday." },
];

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export function ForecastPanel() {
  const [selected, setSelected] = useState(0);
  const today = FORECAST[selected] ?? FORECAST[0]!;
  const meta = WEATHER_META[today.weather];

  const stormyDays = FORECAST.filter((d) => d.weather === "stormy").length;
  const minBalance = Math.min(...FORECAST.map((d) => d.projectedBalance));

  return (
    <div className="space-y-5">
      {PREVIEW_BANNER}

      {/* Today's big forecast */}
      <div
        className="rounded-[var(--radius-lg)] p-6"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{today.weekday}, {today.date} · Financial outlook</p>
            <p className="mt-1 flex items-center gap-3 text-4xl font-extrabold text-white">
              <span className="text-5xl">{meta.icon}</span> {meta.label}
            </p>
            <p className="mt-1 max-w-md text-sm text-white/70">{today.note}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Projected balance</p>
            <p className="text-3xl font-extrabold text-white tabular-nums">{money(today.projectedBalance)}</p>
          </div>
        </div>
      </div>

      {/* 7-day strip */}
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-bold text-text">7-day forecast</p>
        <div className="grid grid-cols-7 gap-1.5">
          {FORECAST.map((d, i) => {
            const m = WEATHER_META[d.weather];
            const isSel = i === selected;
            return (
              <button
                key={d.date}
                onClick={() => setSelected(i)}
                style={{ background: isSel ? m.bg : undefined }}
                className={`flex flex-col items-center gap-1 rounded-[var(--radius-sm)] border p-2 transition-all ${
                  isSel ? "border-primary" : "border-transparent hover:border-border"
                }`}
              >
                <span className="text-[10px] font-semibold text-text-muted">{d.weekday}</span>
                <span className="text-xl">{m.icon}</span>
                <span className="text-[10px] font-semibold tabular-nums text-text">{money(d.projectedBalance)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Alerts */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <p className="text-[11px] font-medium text-text-muted">Storm warnings</p>
          <p className="mt-1 text-2xl font-bold text-danger">{stormyDays} day{stormyDays !== 1 ? "s" : ""}</p>
          <p className="mt-1 text-[11px] text-text-muted">Jun 7 — bill + spending spike overlap</p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <p className="text-[11px] font-medium text-text-muted">Lowest projected balance</p>
          <p className="mt-1 text-2xl font-bold text-warning tabular-nums">{money(minBalance)}</p>
          <p className="mt-1 text-[11px] text-text-muted">Reached Jun 9, just before payday</p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <p className="text-[11px] font-medium text-text-muted">Next clear stretch</p>
          <p className="mt-1 text-2xl font-bold text-success">Jun 14+</p>
          <p className="mt-1 text-[11px] text-text-muted">Paycheck lands — skies clear</p>
        </div>
      </div>

      {/* Recommendation */}
      <div className="rounded-[var(--radius-md)] border border-warning/30 bg-warning/5 p-4">
        <p className="text-sm font-bold text-text">🌂 Pack an umbrella for Saturday</p>
        <p className="mt-1 text-sm text-text-muted">
          A bill and your typical weekend dining surge collide on Jun 7. Moving $150 of discretionary spend to next week keeps every day above your $2,500 comfort floor.
        </p>
      </div>
    </div>
  );
}
