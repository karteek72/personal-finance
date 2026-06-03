"use client";

import { useState } from "react";

const PREVIEW_BANNER = (
  <div className="mb-5 flex items-center gap-2 rounded-[var(--radius-sm)] border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
    <span><strong>Preview</strong> — SpendFlow Wrapped is a planned year-end feature. Data shown is illustrative.</span>
  </div>
);

const SLIDES = [
  {
    id: "intro",
    bg: "var(--gradient-hero)",
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-white/60">SpendFlow</p>
        <p className="text-5xl font-extrabold text-white leading-tight">Your 2025<br />Wrapped</p>
        <p className="text-base text-white/70">365 days. Your money story.</p>
      </div>
    ),
  },
  {
    id: "spent",
    bg: "linear-gradient(135deg, #f97316, #ef4444)",
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-3 px-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-white/60">This year you spent</p>
        <p className="text-6xl font-extrabold text-white">$47,240</p>
        <p className="text-base text-white/70">across 1,847 transactions</p>
        <div className="mt-2 text-sm text-white/80 space-y-1">
          <p>Your top category: <strong className="text-white">Food & Dining</strong></p>
          <p>$14,300 · 482 transactions</p>
        </div>
      </div>
    ),
  },
  {
    id: "saved",
    bg: "linear-gradient(135deg, #22c55e, #16a34a)",
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-3 px-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-white/60">But you also saved</p>
        <p className="text-6xl font-extrabold text-white">$14,820</p>
        <p className="text-base text-white/70">a 23.9% savings rate</p>
        <div className="mt-2 rounded-2xl bg-white/20 px-4 py-2">
          <p className="text-sm text-white">Top 12% of SpendFlow users in your income bracket</p>
        </div>
      </div>
    ),
  },
  {
    id: "personality",
    bg: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-3 px-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-white/60">You are a</p>
        <p className="text-5xl font-extrabold text-white">Foodie</p>
        <p className="text-base text-white/70">Experiences over things. You chose memories.</p>
        <div className="mt-2 space-y-1 text-sm text-white/80">
          <p>482 restaurant visits</p>
          <p>87 Uber Eats orders</p>
          <p>23 trips to Trader Joe&apos;s</p>
        </div>
      </div>
    ),
  },
  {
    id: "moments",
    bg: "linear-gradient(135deg, #06b6d4, #0284c7)",
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-3 px-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-white/60">Biggest moments</p>
        <div className="space-y-2 text-left w-full">
          {[
            { label: "Biggest single purchase", value: "Japan flights — $1,842" },
            { label: "Best savings month", value: "October — saved $1,920" },
            { label: "Most frugal day", value: "17 Tuesdays — $0 spent" },
            { label: "Subscription you forgot", value: "Adobe — $660/yr" },
          ].map((m) => (
            <div key={m.label} className="flex justify-between rounded-xl bg-white/20 px-4 py-2.5">
              <span className="text-xs text-white/70">{m.label}</span>
              <span className="text-xs font-bold text-white">{m.value}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "goals",
    bg: "linear-gradient(135deg, #f59e0b, #d97706)",
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-white/60">Your 2026</p>
        <p className="text-4xl font-extrabold text-white">3 goals.<br />1 mission.</p>
        <div className="space-y-2 w-full">
          {[
            { label: "Emergency fund", target: "$10,000", pct: 64 },
            { label: "Japan trip fund", target: "$4,500", pct: 40 },
            { label: "Max Roth IRA", target: "$7,000", pct: 55 },
          ].map((g) => (
            <div key={g.label} className="rounded-xl bg-white/20 px-4 py-2.5">
              <div className="flex justify-between text-xs text-white mb-1">
                <span>{g.label}</span>
                <span>{g.pct}% → {g.target}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/30">
                <div className="h-full rounded-full bg-white" style={{ width: `${g.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

export default function WrappedPage() {
  const [slide, setSlide] = useState(0);
  const current = SLIDES[slide] ?? SLIDES[0]!;

  return (
    <div className="space-y-5">
      {PREVIEW_BANNER}

      {/* Wrapped card */}
      <div
        className="relative overflow-hidden rounded-[var(--radius-xl)] mx-auto max-w-sm"
        style={{ aspectRatio: "9/16", background: current.bg, maxHeight: "70vh" }}
      >
        {/* Progress bar */}
        <div className="absolute top-4 left-4 right-4 flex gap-1 z-10">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-0.5 rounded-full bg-white/40 overflow-hidden cursor-pointer"
              onClick={() => setSlide(i)}
            >
              <div
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: i <= slide ? "100%" : "0%" }}
              />
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="h-full pt-12">{current.content}</div>

        {/* Nav buttons */}
        <div className="absolute inset-0 flex z-20">
          <button
            className="flex-1"
            onClick={() => slide > 0 && setSlide(slide - 1)}
          />
          <button
            className="flex-1"
            onClick={() => slide < SLIDES.length - 1 && setSlide(slide + 1)}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => slide > 0 && setSlide(slide - 1)}
          disabled={slide === 0}
          className="rounded-[var(--radius-sm)] border border-border px-4 py-1.5 text-sm font-semibold text-text disabled:opacity-30"
        >
          ← Prev
        </button>
        <span className="text-sm text-text-muted">{slide + 1} / {SLIDES.length}</span>
        <button
          onClick={() => slide < SLIDES.length - 1 && setSlide(slide + 1)}
          disabled={slide === SLIDES.length - 1}
          className="rounded-[var(--radius-sm)] border border-border px-4 py-1.5 text-sm font-semibold text-text disabled:opacity-30"
        >
          Next →
        </button>
      </div>

      {/* Share */}
      <div className="flex gap-2 justify-center">
        <button
          className="flex-1 max-w-xs rounded-[var(--radius-md)] py-2.5 text-sm font-semibold text-white"
          style={{ background: "var(--gradient-hero)" }}
        >
          Share my Wrapped
        </button>
      </div>
    </div>
  );
}
