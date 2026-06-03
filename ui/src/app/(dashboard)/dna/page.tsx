"use client";

import { useState } from "react";

const PREVIEW_BANNER = (
  <div className="mb-5 flex items-center gap-2 rounded-[var(--radius-sm)] border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
    <span><strong>Preview</strong> — Spending DNA is a planned feature. Peer comparison is illustrative.</span>
  </div>
);

interface Axis {
  label: string;
  you: number; // 0-100
  peers: number; // 0-100
}

const AXES: Axis[] = [
  { label: "Dining", you: 82, peers: 48 },
  { label: "Travel", you: 64, peers: 38 },
  { label: "Shopping", you: 41, peers: 55 },
  { label: "Groceries", you: 35, peers: 62 },
  { label: "Subscriptions", you: 71, peers: 44 },
  { label: "Transport", you: 28, peers: 50 },
  { label: "Wellness", you: 58, peers: 33 },
  { label: "Savings", you: 76, peers: 51 },
];

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 100;

function polygon(values: number[]): string {
  const n = values.length;
  return values
    .map((v, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const r = (v / 100) * RADIUS;
      const x = CENTER + r * Math.cos(angle);
      const y = CENTER + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function axisPoint(i: number, n: number, factor: number) {
  const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
  return {
    x: CENTER + RADIUS * factor * Math.cos(angle),
    y: CENTER + RADIUS * factor * Math.sin(angle),
  };
}

export default function DnaPage() {
  const [showPeers, setShowPeers] = useState(true);
  const n = AXES.length;

  const distinctive = [...AXES]
    .map((a) => ({ ...a, diff: a.you - a.peers }))
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff))
    .slice(0, 3);

  return (
    <div className="space-y-5">
      {PREVIEW_BANNER}

      {/* Hero */}
      <div className="rounded-[var(--radius-lg)] p-5" style={{ background: "var(--gradient-hero)" }}>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Your spending fingerprint</p>
        <p className="mt-1 text-3xl font-extrabold text-white">The Experience Seeker</p>
        <p className="mt-1 text-sm text-white/70">
          Your DNA skews heavily toward dining, travel and wellness — and you save more than most. Only <strong>6% of peers</strong> in your income bracket share this pattern.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Radar */}
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-text">Spend DNA radar</p>
            <button
              onClick={() => setShowPeers((s) => !s)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                showPeers ? "border-primary bg-primary-soft text-primary" : "border-border text-text-muted"
              }`}
            >
              {showPeers ? "Hiding nothing" : "Show peers"}
            </button>
          </div>
          <div className="flex justify-center">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-auto w-full max-w-[300px]">
              {/* grid rings */}
              {[0.25, 0.5, 0.75, 1].map((f) => (
                <polygon
                  key={f}
                  points={Array.from({ length: n }, (_, i) => {
                    const p = axisPoint(i, n, f);
                    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                  }).join(" ")}
                  fill="none"
                  stroke="var(--color-border)"
                  strokeWidth="1"
                />
              ))}
              {/* spokes */}
              {AXES.map((_, i) => {
                const p = axisPoint(i, n, 1);
                return <line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="var(--color-border)" strokeWidth="1" />;
              })}
              {/* peers */}
              {showPeers && (
                <polygon points={polygon(AXES.map((a) => a.peers))} fill="rgba(148,163,184,0.18)" stroke="#94a3b8" strokeWidth="1.5" />
              )}
              {/* you */}
              <polygon points={polygon(AXES.map((a) => a.you))} fill="rgba(124,58,237,0.25)" stroke="var(--color-primary)" strokeWidth="2" />
              {/* labels */}
              {AXES.map((a, i) => {
                const p = axisPoint(i, n, 1.18);
                return (
                  <text key={a.label} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="fill-text-muted" style={{ fontSize: 9, fontWeight: 600 }}>
                    {a.label}
                  </text>
                );
              })}
            </svg>
          </div>
          <div className="mt-2 flex justify-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> You</span>
            {showPeers && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#94a3b8]" /> Peers</span>}
          </div>
        </div>

        {/* Distinctive traits */}
        <div className="space-y-3">
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <p className="mb-2 text-sm font-bold text-text">What makes you, you</p>
            <div className="space-y-2">
              {distinctive.map((a) => (
                <div key={a.label} className="flex items-center justify-between rounded-[var(--radius-sm)] border border-border px-3 py-2">
                  <span className="text-sm font-semibold text-text">{a.label}</span>
                  <span className={`text-sm font-bold ${a.diff > 0 ? "text-primary" : "text-text-muted"}`}>
                    {a.diff > 0 ? "+" : ""}{a.diff} vs peers
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <p className="mb-2 text-sm font-bold text-text">All dimensions</p>
            <div className="space-y-2">
              {AXES.map((a) => (
                <div key={a.label}>
                  <div className="mb-0.5 flex justify-between text-[11px]">
                    <span className="text-text-muted">{a.label}</span>
                    <span className="font-semibold text-text">{a.you}</span>
                  </div>
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-border">
                    <div className="absolute h-full rounded-full bg-primary" style={{ width: `${a.you}%` }} />
                    {showPeers && (
                      <div className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-[#94a3b8]" style={{ left: `${a.peers}%` }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button className="w-full rounded-[var(--radius-md)] border border-primary/40 bg-primary-soft py-3 text-sm font-bold text-primary transition-all hover:bg-primary-soft/70">
        Share your DNA card →
      </button>
    </div>
  );
}
