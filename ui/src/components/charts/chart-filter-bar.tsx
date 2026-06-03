"use client";

import clsx from "clsx";

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
}

const SCOPE_OPTIONS: { id: ViewScope; label: string }[] = [
  { id: "household", label: "Family" },
  { id: "personal", label: "Mine" },
  { id: "all", label: "Everything" },
];

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
}: ChartFilterBarProps) {
  const hasFilters = Boolean(
    selectedAccountId || selectedCategory || selectedMemberId,
  );

  return (
    <div className="flex flex-col gap-3">
      {onScopeChange ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            View
          </span>
          {SCOPE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onScopeChange(option.id)}
              className={clsx(
                "rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-all",
                scope === option.id
                  ? "bg-primary text-text-inverse"
                  : "bg-surface text-text-muted card-shadow hover:text-text",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {members.length > 0 && onMemberChange ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Member
          </span>
          <button
            type="button"
            onClick={() => onMemberChange("")}
            className={clsx(
              "rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-all",
              !selectedMemberId
                ? "bg-primary text-text-inverse"
                : "bg-surface text-text-muted card-shadow hover:text-text",
            )}
          >
            All
          </button>
          {members.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() =>
                onMemberChange(
                  selectedMemberId === member.id ? "" : member.id,
                )
              }
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-all",
                selectedMemberId === member.id
                  ? "bg-primary text-text-inverse"
                  : "bg-surface text-text-muted card-shadow hover:text-text",
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: member.avatarColor }}
              />
              {member.displayName}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Account
        </span>
        <button
          type="button"
          onClick={() => onAccountChange("")}
          className={clsx(
            "rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-all",
            !selectedAccountId
              ? "bg-primary text-text-inverse"
              : "bg-surface text-text-muted card-shadow hover:text-text",
          )}
        >
          All
        </button>
        {accounts.map((account) => (
          <button
            key={account.id}
            type="button"
            onClick={() =>
              onAccountChange(
                selectedAccountId === account.id ? "" : account.id,
              )
            }
            className={clsx(
              "rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-all",
              selectedAccountId === account.id
                ? "bg-primary text-text-inverse"
                : "bg-surface text-text-muted card-shadow hover:text-text",
            )}
          >
            {account.mask ? `••${account.mask}` : account.name}
          </button>
        ))}
      </div>

      {categories.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Category
          </span>
          <button
            type="button"
            onClick={() => onCategoryChange("")}
            className={clsx(
              "rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-all",
              !selectedCategory
                ? "bg-primary text-text-inverse"
                : "bg-surface text-text-muted card-shadow hover:text-text",
            )}
          >
            All
          </button>
          {categories.slice(0, 8).map((category) => (
            <button
              key={category}
              type="button"
              onClick={() =>
                onCategoryChange(
                  selectedCategory === category ? "" : category,
                )
              }
              className={clsx(
                "rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-all",
                selectedCategory === category
                  ? "bg-primary text-text-inverse"
                  : "bg-surface text-text-muted card-shadow hover:text-text",
              )}
            >
              {category}
            </button>
          ))}
        </div>
      ) : null}

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
