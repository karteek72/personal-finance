"use client";

import { useState } from "react";

import {
  FeatureEmptyState,
  FeaturePanelLoading,
} from "@/components/preview/feature-empty-state";
import { useFeaturePanelGate } from "@/components/preview/use-feature-panel-gate";
import { useForecast } from "@/hooks/use-features";

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

function asWeather(w: string): Weather {
  return w === "sunny" || w === "partly" || w === "cloudy" || w === "stormy" ? w : "cloudy";
}

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export function ForecastPanel() {
  const [selected, setSelected] = useState(0);
  const gate = useFeaturePanelGate("cash-flow forecast");
  const { data, isLoading } = useForecast();

  if (!gate.ready) return gate.node;
  if (isLoading) return <FeaturePanelLoading />;

  const FORECAST: DayForecast[] = (data?.days ?? []).map((d) => ({
    date: d.date,
    weekday: d.weekday,
    weather: asWeather(d.weather),
    projectedBalance: Number.parseFloat(d.projectedBalance),
    note: d.note,
  }));

  if (FORECAST.length === 0) {
    return <FeatureEmptyState feature="cash-flow forecast" variant="insufficient-data" />;
  }

  const today = FORECAST[selected] ?? FORECAST[0]!;
  const meta = WEATHER_META[today.weather];

  const stormyDays = FORECAST.filter((d) => d.weather === "stormy" || d.weather === "cloudy").length;
  const minBalance = Number.parseFloat(
    data?.minBalance ?? String(Math.min(...FORECAST.map((d) => d.projectedBalance))),
  );
  const lowestDay = data?.lowestDay ?? "—";
  const nextClearDate = data?.nextClearDate ?? "—";
  const comfortFloor = data ? Number.parseFloat(data.comfortFloor) : 0;
  const recommendation = data?.recommendation;

  return (
    <div className="space-y-5">
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
          <p className="text-[11px] font-medium text-text-muted">Cloudy / storm days</p>
          <p className="mt-1 text-2xl font-bold text-danger">{stormyDays} day{stormyDays !== 1 ? "s" : ""}</p>
          <p className="mt-1 text-[11px] text-text-muted">Bill + spending spike overlap</p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <p className="text-[11px] font-medium text-text-muted">Lowest projected balance</p>
          <p className="mt-1 text-2xl font-bold text-warning tabular-nums">{money(minBalance)}</p>
          <p className="mt-1 text-[11px] text-text-muted">Reached {lowestDay}, just before payday</p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <p className="text-[11px] font-medium text-text-muted">Next clear stretch</p>
          <p className="mt-1 text-2xl font-bold text-success">{nextClearDate}+</p>
          <p className="mt-1 text-[11px] text-text-muted">Paycheck lands — skies clear</p>
        </div>
      </div>

      {/* Recommendation */}
      {recommendation ? (
        <div className="rounded-[var(--radius-md)] border border-warning/30 bg-warning/5 p-4">
          <p className="text-sm font-bold text-text">🌂 Plan ahead for the dip</p>
          <p className="mt-1 text-sm text-text-muted">{recommendation}</p>
          {comfortFloor > 0 ? (
            <p className="mt-1 text-[11px] text-text-muted">Comfort floor: {money(comfortFloor)}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
