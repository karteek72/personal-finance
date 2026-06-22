"use client";

import { useMemo } from "react";

import { FilterSelect } from "@/components/ui/filter-select";
import type { Account, HouseholdMember } from "@/types/api";
import type { ViewScope } from "@/stores/view-mode-store";

interface ChartFilterBarProps {
  accounts: Account[];
  categories: string[];
  members?: HouseholdMember[];
  selectedAccountId: string;
  selectedCategory: string;
  selectedMemberId?: string;
  scope?: ViewScope;
  onScopeChange?: (scope: ViewScope) => void;
  onAccountChange: (accountId: string) => void;
  onCategoryChange: (category: string) => void;
  onMemberChange?: (memberId: string) => void;
  onClear: () => void;
  showAccountFilter?: boolean;
  showCategoryFilter?: boolean;
  showMemberFilter?: boolean;
}

const SCOPE_OPTIONS: { value: ViewScope; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "household", label: "Family" },
  { value: "personal", label: "Mine" },
];

function accountLabel(account: Account): string {
  if (account.mask) {
    return `${account.name} ••${account.mask}`;
  }
  return account.name;
}

export function ChartFilterBar({
  accounts,
  categories,
  members = [],
  selectedAccountId,
  selectedCategory,
  selectedMemberId = "",
  scope = "all",
  onScopeChange,
  onAccountChange,
  onCategoryChange,
  onMemberChange,
  onClear,
  showAccountFilter = true,
  showCategoryFilter = true,
  showMemberFilter = true,
}: ChartFilterBarProps) {
  const hasFilters = Boolean(
    selectedAccountId || selectedCategory || selectedMemberId,
  );

  const scopeOptions = useMemo(
    () =>
      SCOPE_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    [],
  );

  const memberOptions = useMemo(
    () => [
      { value: "", label: "All people" },
      ...members.map((member) => ({
        value: member.id,
        label: member.displayName,
      })),
    ],
    [members],
  );

  const accountOptions = useMemo(
    () => [
      { value: "", label: "All accounts" },
      ...accounts.map((account) => ({
        value: account.id,
        label: accountLabel(account),
      })),
    ],
    [accounts],
  );

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "All categories" },
      ...categories.map((category) => ({
        value: category,
        label: category,
      })),
    ],
    [categories],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {onScopeChange ? (
          <FilterSelect
            id="chart-scope-filter"
            label="View"
            value={scope}
            onChange={(value) => onScopeChange(value as ViewScope)}
            options={scopeOptions}
          />
        ) : null}

        {showMemberFilter && members.length > 0 && onMemberChange ? (
          <FilterSelect
            id="chart-member-filter"
            label="Person"
            value={selectedMemberId}
            onChange={onMemberChange}
            options={memberOptions}
          />
        ) : null}

        {showAccountFilter ? (
          <FilterSelect
            id="chart-account-filter"
            label="Account"
            value={selectedAccountId}
            onChange={onAccountChange}
            options={accountOptions}
          />
        ) : null}

        {showCategoryFilter && categories.length > 0 ? (
          <FilterSelect
            id="chart-category-filter"
            label="Category"
            value={selectedCategory}
            onChange={onCategoryChange}
            options={categoryOptions}
          />
        ) : null}
      </div>

      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="self-start text-xs font-semibold text-primary hover:underline"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
