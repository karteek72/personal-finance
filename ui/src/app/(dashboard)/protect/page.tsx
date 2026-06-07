"use client";

import { PreviewHub } from "@/components/preview/preview-hub";
import { ResiliencePanel } from "@/components/preview/panels/resilience-panel";
import { InflationPanel } from "@/components/preview/panels/inflation-panel";

export default function ProtectPage() {
  return (
    <PreviewHub
      tabs={[
        { id: "resilience", label: "Resilience", Panel: ResiliencePanel },
        { id: "inflation", label: "Inflation Intel", Panel: InflationPanel },
      ]}
    />
  );
}
