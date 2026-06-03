"use client";

import { useState } from "react";

import { useWrapped } from "@/hooks/use-features";
import type { WrappedResponse } from "@/types/api";

interface Slide {
  id: string;
  bg: string;
  content: React.ReactNode;
}

function usd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

const FALLBACK: WrappedResponse = {
  year: 2025,
  totalSpent: "47240",
  transactionCount: 1847,
  totalSaved: "14820",
  savingsRate: 23.9,
  peerPercentile: "Top 12% of SpendFlow users in your income bracket",
  archetype: "Foodie",
  topCategory: { name: "Food & Dining", amount: "14300" },
  personality: { "Restaurant visits": 482, "Food-delivery orders": 87, "Grocery runs": 23 },
  moments: [
    { label: "Biggest single purchase", value: "Japan flights — $1,842" },
    { label: "Best savings month", value: "October — saved $1,920" },
    { label: "Most frugal day", value: "17 Tuesdays — $0 spent" },
    { label: "Subscription you forgot", value: "Adobe — $660/yr" },
  ],
  goals: [
    { label: "Emergency fund", target: "10000", pct: 64 },
    { label: "Japan trip fund", target: "4500", pct: 40 },
    { label: "Max Roth IRA", target: "7000", pct: 55 },
  ],
};

function buildSlides(w: WrappedResponse): Slide[] {
  return [
    {
      id: "intro",
      bg: "var(--gradient-hero)",
      content: (
        <div className="flex h-full flex-col items-center justify-center space-y-4 px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/60">SpendFlow</p>
          <p className="text-5xl font-extrabold leading-tight text-white">Your {w.year}<br />Wrapped</p>
          <p className="text-base text-white/70">365 days. Your money story.</p>
        </div>
      ),
    },
    {
      id: "spent",
      bg: "linear-gradient(135deg, #f97316, #ef4444)",
      content: (
        <div className="flex h-full flex-col items-center justify-center space-y-3 px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/60">This year you spent</p>
          <p className="text-6xl font-extrabold text-white">{usd(Number.parseFloat(w.totalSpent))}</p>
          <p className="text-base text-white/70">across {w.transactionCount.toLocaleString()} transactions</p>
          <div className="mt-2 space-y-1 text-sm text-white/80">
            <p>Your top category: <strong className="text-white">{w.topCategory.name}</strong></p>
            <p>{usd(Number.parseFloat(w.topCategory.amount))}</p>
          </div>
        </div>
      ),
    },
    {
      id: "saved",
      bg: "linear-gradient(135deg, #22c55e, #16a34a)",
      content: (
        <div className="flex h-full flex-col items-center justify-center space-y-3 px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/60">But you also saved</p>
          <p className="text-6xl font-extrabold text-white">{usd(Number.parseFloat(w.totalSaved))}</p>
          <p className="text-base text-white/70">a {w.savingsRate.toFixed(1)}% savings rate</p>
          {w.peerPercentile && (
            <div className="mt-2 rounded-2xl bg-white/20 px-4 py-2">
              <p className="text-sm text-white">{w.peerPercentile}</p>
            </div>
          )}
        </div>
      ),
    },
    {
      id: "personality",
      bg: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
      content: (
        <div className="flex h-full flex-col items-center justify-center space-y-3 px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/60">You are a</p>
          <p className="text-5xl font-extrabold text-white">{w.archetype ?? "Spender"}</p>
          <p className="text-base text-white/70">Experiences over things. You chose memories.</p>
          <div className="mt-2 space-y-1 text-sm text-white/80">
            {Object.entries(w.personality).map(([label, value]) => (
              <p key={label}>{value.toLocaleString()} {label.toLowerCase()}</p>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "moments",
      bg: "linear-gradient(135deg, #06b6d4, #0284c7)",
      content: (
        <div className="flex h-full flex-col items-center justify-center space-y-3 px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/60">Biggest moments</p>
          <div className="w-full space-y-2 text-left">
            {w.moments.map((m) => (
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
        <div className="flex h-full flex-col items-center justify-center space-y-4 px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/60">Your {w.year + 1}</p>
          <p className="text-4xl font-extrabold text-white">{w.goals.length} goals.<br />1 mission.</p>
          <div className="w-full space-y-2">
            {w.goals.map((g) => (
              <div key={g.label} className="rounded-xl bg-white/20 px-4 py-2.5">
                <div className="mb-1 flex justify-between text-xs text-white">
                  <span>{g.label}</span>
                  <span>{g.pct}% → {usd(Number.parseFloat(g.target))}</span>
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
}

export function WrappedBanner() {
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const { data } = useWrapped();

  const SLIDES = buildSlides(data ?? FALLBACK);
  const current = SLIDES[slide] ?? SLIDES[0]!;

  return (
    <>
      {/* Seasonal entry banner */}
      <button
        onClick={() => {
          setSlide(0);
          setOpen(true);
        }}
        className="flex w-full items-center gap-3 overflow-hidden rounded-[var(--radius-lg)] p-4 text-left"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg">🎁</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Your {(data ?? FALLBACK).year} Wrapped is ready</p>
          <p className="truncate text-xs text-white/70">Your year in money, as a story. Tap to play.</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">Play</span>
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4">
          <button
            onClick={() => setOpen(false)}
            aria-label="Close Wrapped"
            className="absolute right-4 top-4 z-10 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>

          <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[var(--radius-xl)]" style={{ aspectRatio: "9/16", background: current.bg, maxHeight: "78vh" }}>
            {/* Progress */}
            <div className="absolute left-4 right-4 top-4 z-10 flex gap-1">
              {SLIDES.map((_, i) => (
                <div key={i} className="h-0.5 flex-1 cursor-pointer overflow-hidden rounded-full bg-white/40" onClick={() => setSlide(i)}>
                  <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: i <= slide ? "100%" : "0%" }} />
                </div>
              ))}
            </div>

            <div className="h-full pt-12">{current.content}</div>

            {/* Tap zones */}
            <div className="absolute inset-0 z-20 flex">
              <button className="flex-1" aria-label="Previous" onClick={() => slide > 0 && setSlide(slide - 1)} />
              <button className="flex-1" aria-label="Next" onClick={() => slide < SLIDES.length - 1 && setSlide(slide + 1)} />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <button onClick={() => slide > 0 && setSlide(slide - 1)} disabled={slide === 0} className="rounded-[var(--radius-sm)] border border-white/30 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-30">
              ← Prev
            </button>
            <span className="text-sm text-white/70">{slide + 1} / {SLIDES.length}</span>
            <button onClick={() => slide < SLIDES.length - 1 && setSlide(slide + 1)} disabled={slide === SLIDES.length - 1} className="rounded-[var(--radius-sm)] border border-white/30 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-30">
              Next →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
