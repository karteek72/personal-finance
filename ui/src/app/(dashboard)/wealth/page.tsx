"use client";

import { PreviewHub } from "@/components/preview/preview-hub";
import { NetWorthPanel } from "@/components/preview/panels/net-worth-panel";
import { InvestmentsPanel } from "@/components/preview/panels/investments-panel";
import { FirePanel } from "@/components/preview/panels/fire-panel";
import { TimeMachinePanel } from "@/components/preview/panels/time-machine-panel";

export default function WealthPage() {
  return (
    <PreviewHub
      tabs={[
        { id: "net-worth", label: "Net Worth", Panel: NetWorthPanel },
        { id: "investments", label: "Investments", Panel: InvestmentsPanel },
        { id: "fire", label: "FIRE", Panel: FirePanel },
        { id: "time-machine", label: "Time Machine", Panel: TimeMachinePanel },
      ]}
    />
  );
}
