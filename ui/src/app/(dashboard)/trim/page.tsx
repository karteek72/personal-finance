"use client";

import { PreviewHub } from "@/components/preview/preview-hub";
import { SubscriptionsPanel } from "@/components/preview/panels/subscriptions-panel";
import { LeaksPanel } from "@/components/preview/panels/leaks-panel";

export default function TrimPage() {
  return (
    <PreviewHub
      tabs={[
        { id: "subscriptions", label: "Subscriptions", Panel: SubscriptionsPanel },
        { id: "leaks", label: "Money Leaks", Panel: LeaksPanel },
      ]}
    />
  );
}
