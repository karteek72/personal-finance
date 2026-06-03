"use client";

import { PreviewHub } from "@/components/preview/preview-hub";
import { WellnessPanel } from "@/components/preview/panels/wellness-panel";
import { DnaPanel } from "@/components/preview/panels/dna-panel";
import { BehavioralPanel } from "@/components/preview/panels/behavioral-panel";
import { MerchantsPanel } from "@/components/preview/panels/merchants-panel";

export default function UnderstandPage() {
  return (
    <PreviewHub
      tabs={[
        { id: "wellness", label: "Wellness Score", Panel: WellnessPanel },
        { id: "dna", label: "Spending DNA", Panel: DnaPanel },
        { id: "behavioral", label: "Behavioral", Panel: BehavioralPanel },
        { id: "merchants", label: "Merchants & Income", Panel: MerchantsPanel },
      ]}
    />
  );
}
