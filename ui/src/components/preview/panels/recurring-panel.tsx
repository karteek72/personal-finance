"use client";

import { useFeaturePanelGate } from "@/components/preview/use-feature-panel-gate";

import { SubscriptionsPanel } from "./subscriptions-panel";
import { LeaksPanel } from "./leaks-panel";

export function RecurringPanel() {
  const gate = useFeaturePanelGate("subscriptions and money leaks");
  if (!gate.ready) return gate.node;

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 px-1 text-sm font-bold text-text">Subscriptions</h3>
        <SubscriptionsPanel />
      </section>
      <section>
        <h3 className="mb-3 px-1 text-sm font-bold text-text">Money leaks</h3>
        <LeaksPanel />
      </section>
    </div>
  );
}
