"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { CashFlowOverviewStrips } from "@/components/charts/cash-flow-overview-strip";
import { CategoryAnalyticsPanel } from "@/components/charts/category-analytics-panel";
import { MerchantsPanel } from "@/components/preview/panels/merchants-panel";
import { PatternsPanel } from "@/components/preview/panels/patterns-panel";
import { AsyncPanel } from "@/components/ui/async-panel";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageHeader } from "@/components/ui/page-header";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { useHousehold } from "@/hooks/use-household";

/* ─── Page ───────────────────────────────────────────────────────── */

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "merchants", label: "Merchants" },
  { id: "patterns", label: "Patterns" },
] as const;

type SpendTab = (typeof TABS)[number]["id"];

function OverviewTab() {
  const { data, isLoading, isFetching, error } = useCategories();
  const { data: accountsData } = useAccounts();
  const { data: householdData } = useHousehold();
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");

  const hasMultipleAccounts = (accountsData?.accounts.length ?? 0) > 1;
  const hasMultipleMembers = (householdData?.members.length ?? 0) > 1;
  const showTopFilters = hasMultipleAccounts || hasMultipleMembers;

  const accountOptions = useMemo(
    () => [
      { value: "", label: "All accounts" },
      ...(accountsData?.accounts.map((account) => ({
        value: account.id,
        label: account.mask
          ? `${account.name} ••${account.mask}`
          : account.name,
      })) ?? []),
    ],
    [accountsData],
  );

  const memberOptions = useMemo(
    () => [
      { value: "", label: "All people" },
      ...(householdData?.members.map((member) => ({
        value: member.id,
        label: member.displayName,
      })) ?? []),
    ],
    [householdData],
  );

  return (
    <AsyncPanel
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      loadingMessage="Loading categories…"
      errorMessage="Failed to load categories"
    >
      <div className="flex flex-col gap-5">
        {showTopFilters ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
            {hasMultipleMembers ? (
              <FilterSelect
                id="spend-overview-member-filter"
                label="Person"
                value={selectedMemberId}
                onChange={setSelectedMemberId}
                options={memberOptions}
              />
            ) : null}
            {hasMultipleAccounts ? (
              <FilterSelect
                id="spend-overview-account-filter"
                label="Account"
                value={selectedAccountId}
                onChange={setSelectedAccountId}
                options={accountOptions}
              />
            ) : null}
          </div>
        ) : null}

        <CashFlowOverviewStrips
          accountId={selectedAccountId}
          memberId={selectedMemberId}
        />

        <CategoryAnalyticsPanel
          initialCategories={data?.categories ?? []}
          selectedAccountId={selectedAccountId}
          onAccountChange={setSelectedAccountId}
          selectedMemberId={selectedMemberId}
          onMemberChange={setSelectedMemberId}
          hideAccountFilter={hasMultipleAccounts}
          hideMemberFilter={hasMultipleMembers}
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
