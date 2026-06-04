"use client";

import { useState } from "react";
import clsx from "clsx";
import { CashFlowOverviewStrips } from "@/components/charts/cash-flow-overview-strip";
import { CategoryAnalyticsPanel } from "@/components/charts/category-analytics-panel";
import { MerchantsPanel } from "@/components/preview/panels/merchants-panel";
import { PatternsPanel } from "@/components/preview/panels/patterns-panel";
import { AsyncPanel } from "@/components/ui/async-panel";
import { PageHeader } from "@/components/ui/page-header";
import { useCategories } from "@/hooks/use-categories";

/* ─── Page ───────────────────────────────────────────────────────── */

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "merchants", label: "Merchants" },
  { id: "patterns", label: "Patterns" },
] as const;

type SpendTab = (typeof TABS)[number]["id"];

function OverviewTab() {
  const { data, isLoading, isFetching, error } = useCategories();
  const [selectedAccountId, setSelectedAccountId] = useState("");

  return (
    <AsyncPanel
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      loadingMessage="Loading categories…"
      errorMessage="Failed to load categories"
    >
      <div className="flex flex-col gap-5">
        <CashFlowOverviewStrips accountId={selectedAccountId} />

        <CategoryAnalyticsPanel
          initialCategories={data?.categories ?? []}
          selectedAccountId={selectedAccountId}
          onAccountChange={setSelectedAccountId}
        />
      </div>
    </AsyncPanel>
  );
}

export default function CategoriesPage() {
  const [activeTab, setActiveTab] = useState<SpendTab>("overview");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Where your money goes"
        subtitle="Yearly and monthly overview, top merchants, and spending patterns"
      />

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={clsx(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
              activeTab === t.id
                ? "bg-primary text-white"
                : "bg-surface-raised text-text-muted hover:text-text",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "merchants" && <MerchantsPanel />}
      {activeTab === "patterns" && <PatternsPanel />}
    </div>
  );
}
