"use client";

import { formatMoneyValue } from "@/lib/format-money";
import type { PruneLosersResponse } from "@/types/api";

interface Props {
  pruneLosers: PruneLosersResponse;
}

export function TrimLosersCard({ pruneLosers }: Props) {
  if (!pruneLosers.available) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-border bg-surface p-4">
        <p className="text-sm font-semibold text-text">Trim losers (what-if)</p>
        <p className="mt-2 text-xs text-text-muted">
          {pruneLosers.caveats.at(-1) ??
            "Momentum scoring unavailable until enough price history is collected."}
        </p>
      </div>
    );
  }

  const { whatIf, cutCandidates } = pruneLosers;
  if (!whatIf || cutCandidates.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-text">Trim losers (what-if)</p>
        <p className="mt-2 text-xs text-text-muted">
          No cut candidates right now — losing positions are not showing deteriorating momentum.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-warning/30 bg-warning/5 p-4">
      <p className="text-sm font-semibold text-text">Trim losers (what-if)</p>
      <p className="mt-1 text-[10px] text-text-muted">
        {pruneLosers.caveats.slice(0, 3).join(" ")}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-[var(--radius-sm)] bg-surface px-3 py-2">
          <p className="text-[10px] text-text-muted">Capital freed</p>
          <p className="text-sm font-bold text-text">
            {formatMoneyValue(Number.parseFloat(whatIf.capitalFreed))}
          </p>
        </div>
        <div className="rounded-[var(--radius-sm)] bg-surface px-3 py-2">
          <p className="text-[10px] text-text-muted">Harvestable loss</p>
          <p className="text-sm font-bold text-danger">
            {formatMoneyValue(Number.parseFloat(whatIf.harvestableLoss))}
          </p>
        </div>
        <div className="rounded-[var(--radius-sm)] bg-surface px-3 py-2">
          <p className="text-[10px] text-text-muted">Projected uplift (range)</p>
          <p className="text-sm font-bold text-text">
            {formatMoneyValue(Number.parseFloat(whatIf.projectedUpliftLow))} –{" "}
            {formatMoneyValue(Number.parseFloat(whatIf.projectedUpliftHigh))}
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {cutCandidates.map((c) => (
          <li
            key={c.holdingId}
            className="flex items-center justify-between rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-xs"
          >
            <div>
              <p className="font-semibold text-text">
                {c.ticker} · {c.name}
              </p>
              <p className="text-text-muted">
                Momentum {c.momentumScore} ({c.momentumSignal})
              </p>
            </div>
            <p className="font-bold text-danger">
              {formatMoneyValue(Number.parseFloat(c.gainLoss))}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
