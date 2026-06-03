"use client";

import { PreviewHub } from "@/components/preview/preview-hub";
import { WellnessPanel } from "@/components/preview/panels/wellness-panel";
import { DnaPanel } from "@/components/preview/panels/dna-panel";
import { BehavioralPanel } from "@/components/preview/panels/behavioral-panel";

export default function InsightsPage() {
  return (
    <PreviewHub
      tabs={[
        { id: "wellness", label: "Wellness Score", Panel: WellnessPanel },
        { id: "dna", label: "Spending DNA", Panel: DnaPanel },
        { id: "behavioral", label: "Behavioral", Panel: BehavioralPanel },
      ]}
    />
  );
}
