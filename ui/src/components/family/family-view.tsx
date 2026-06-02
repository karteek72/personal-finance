"use client";

import clsx from "clsx";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  useHousehold,
  useHouseholdInsights,
  useHouseholdMutations,
} from "@/hooks/use-household";
import { formatMoney } from "@/lib/format-money";
import type { HouseholdMemberRole } from "@/types/api";

const ROLE_LABELS: Record<HouseholdMemberRole, string> = {
  owner: "Owner",
  partner: "Partner",
  child: "Child",
  other: "Other",
};

export function FamilyView() {
  const { data, isLoading, error } = useHousehold();
  const { data: insights } = useHouseholdInsights();
  const mutations = useHouseholdMutations();

  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"partner" | "child" | "other">("partner");
  const [householdName, setHouseholdName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const insightByMember = new Map(
    insights?.members.map((member) => [member.memberId, member]) ?? [],
  );

  async function handleAddMember(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    setBusyId("new");
    try {
      await mutations.createMember({
        displayName: newName.trim(),
        role: newRole,
      });
      setNewName("");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRenameHousehold() {
    if (!householdName.trim() || !data) return;
    await mutations.renameHousehold(householdName.trim());
    setEditingName(false);
  }

  async function handleAssign(accountId: string, memberId: string) {
    setBusyId(accountId);
    try {
      await mutations.assignAccount(accountId, memberId);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteMember(memberId: string, role: HouseholdMemberRole) {
    if (role === "owner") return;
    const confirmed = window.confirm("Remove this family member? Their account links will be removed.");
    if (!confirmed) return;
    setBusyId(memberId);
    try {
      await mutations.deleteMember(memberId);
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-text-muted">Loading family…</p>;
  }

  if (error || !data) {
    return <p className="text-sm text-danger">Couldn't load family data.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Family"
        subtitle="Assign cards and accounts to see who's spending what"
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {editingName ? (
            <div className="flex flex-1 items-center gap-2">
              <input
                value={householdName}
                onChange={(event) => setHouseholdName(event.target.value)}
                placeholder={data.household.name}
                className="flex-1 rounded-[var(--radius-sm)] border-0 bg-bg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={() => void handleRenameHousehold()}
                className="rounded-[var(--radius-pill)] bg-primary px-4 py-2 text-xs font-semibold text-text-inverse"
              >
                Save
              </button>
            </div>
          ) : (
            <>
              <div>
                <p className="text-lg font-bold text-text">{data.household.name}</p>
                <p className="text-sm text-text-muted">
                  {data.members.length} members · {data.accounts.length} accounts
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHouseholdName(data.household.name);
                  setEditingName(true);
                }}
                className="rounded-[var(--radius-pill)] bg-primary-soft px-4 py-2 text-xs font-semibold text-primary"
              >
                Rename
              </button>
            </>
          )}
        </div>

        {insights ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[var(--radius-sm)] bg-primary-soft/50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-text-muted">Family spent</p>
              <p className="text-lg font-bold tabular-nums" data-money>
                {formatMoney(insights.householdTotals.expenses)}
              </p>
            </div>
            <div className="rounded-[var(--radius-sm)] bg-success/10 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-text-muted">Income</p>
              <p className="text-lg font-bold tabular-nums text-success" data-money>
                {formatMoney(insights.householdTotals.income)}
              </p>
            </div>
            <div className="rounded-[var(--radius-sm)] bg-primary-soft/50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-text-muted">Net</p>
              <p className="text-lg font-bold tabular-nums text-primary" data-money>
                {formatMoney(insights.householdTotals.net)}
              </p>
            </div>
          </div>
        ) : null}
      </Card>

      <section aria-label="Family members" className="grid gap-4 sm:grid-cols-2">
        {data.members.map((member) => {
          const stats = insightByMember.get(member.id);
          const memberAccounts = data.accounts.filter(
            (account) => account.memberId === member.id,
          );

          return (
            <Card key={member.id} className="relative overflow-hidden">
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: member.avatarColor }}
              />
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-text-inverse"
                    style={{ backgroundColor: member.avatarColor }}
                  >
                    {member.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-text">{member.displayName}</h3>
                    <p className="text-xs text-text-muted">{ROLE_LABELS[member.role]}</p>
                  </div>
                </div>
                {member.role !== "owner" ? (
                  <button
                    type="button"
                    disabled={busyId === member.id}
                    onClick={() => void handleDeleteMember(member.id, member.role)}
                    className="text-xs font-semibold text-danger hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              {stats ? (
                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-text-muted">Spent (YTD)</dt>
                    <dd className="mt-0.5 font-bold tabular-nums" data-money>
                      {formatMoney(stats.totalSpent)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Top category</dt>
                    <dd className="mt-0.5 truncate font-semibold text-text">
                      {stats.topCategory.name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Accounts</dt>
                    <dd className="mt-0.5 font-semibold">{stats.accountCount}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Income</dt>
                    <dd className="mt-0.5 font-bold tabular-nums text-success" data-money>
                      {formatMoney(stats.totalIncome)}
                    </dd>
                  </div>
                </dl>
              ) : null}

              {memberAccounts.length > 0 ? (
                <ul className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
                  {memberAccounts.map((account) => (
                    <li
                      key={account.accountId}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="truncate text-text-muted">
                        {account.name}
                        {account.mask ? ` · ••${account.mask}` : ""}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums" data-money>
                        {formatMoney(account.balanceCurrent)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 border-t border-border/60 pt-3 text-xs text-text-muted">
                  No accounts assigned yet
                </p>
              )}
            </Card>
          );
        })}
      </section>

      <Card>
        <h3 className="text-sm font-bold text-text">Add family member</h3>
        <p className="mt-1 text-xs text-text-muted">
          Partner, child, or other — then assign their cards below
        </p>
        <form
          onSubmit={(event) => void handleAddMember(event)}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Name (e.g. Alex, Jordan)"
            className="flex-1 rounded-[var(--radius-sm)] border-0 bg-bg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <select
            value={newRole}
            onChange={(event) =>
              setNewRole(event.target.value as "partner" | "child" | "other")
            }
            className="rounded-[var(--radius-sm)] border-0 bg-bg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="partner">Partner</option>
            <option value="child">Child</option>
            <option value="other">Other</option>
          </select>
          <button
            type="submit"
            disabled={busyId === "new"}
            className="rounded-[var(--radius-pill)] bg-primary px-5 py-2.5 text-sm font-semibold text-text-inverse disabled:opacity-50"
          >
            Add member
          </button>
        </form>
      </Card>

      <section aria-label="Account assignments">
        <h3 className="mb-3 text-sm font-bold text-text">Assign accounts</h3>
        <div className="grid gap-3">
          {data.accounts.map((account) => (
            <Card key={account.accountId} padding="sm" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-semibold text-text">{account.name}</p>
                <p className="truncate text-xs text-text-muted">
                  {account.institutionName}
                  {account.mask ? ` · ••${account.mask}` : ""}
                </p>
              </div>
              <select
                value={account.memberId ?? ""}
                disabled={busyId === account.accountId}
                onChange={(event) =>
                  void handleAssign(account.accountId, event.target.value)
                }
                className={clsx(
                  "rounded-[var(--radius-sm)] border-0 bg-bg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30",
                  !account.memberId && "text-warning",
                )}
              >
                <option value="" disabled>
                  Assign to…
                </option>
                {data.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </Card>
          ))}
        </div>
      </section>

      {insights && insights.unassignedAccounts.length > 0 ? (
        <Card className="border-warning/30 bg-warning/5">
          <p className="text-sm font-semibold text-warning">
            {insights.unassignedAccounts.length} account(s) not assigned
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Assign accounts to members for accurate family spending breakdowns.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
