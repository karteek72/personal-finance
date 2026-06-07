"use client";

import { useMemo, useState } from "react";

import {
  FeatureEmptyState,
  FeaturePanelLoading,
} from "@/components/preview/feature-empty-state";
import { useFeaturePanelGate } from "@/components/preview/use-feature-panel-gate";
import { MetricLiveBadge } from "@/components/ui/metric-live-badge";
import { ModalPortal } from "@/components/ui/modal-portal";
import { useCategories } from "@/hooks/use-categories";
import {
  useBudgets,
  useCreateGoal,
  useDeleteBudget,
  useDeleteGoal,
  usePatchBudget,
  usePatchGoal,
  useUpsertBudget,
} from "@/hooks/use-features";
import { formatMoney } from "@/lib/format-money";
import type {
  BudgetClass,
  BudgetItem,
  GoalItem,
  GoalKind,
  SuggestionConfidence,
} from "@/types/api";

const DEFAULT_BUDGET_COLOR = "#3b82f6";
const DEFAULT_GOAL_COLOR = "#22c55e";

function parseAmount(value: string): number {
  return Number.parseFloat(value);
}

function isDismissedBudget(budget: BudgetItem): boolean {
  return budget.source === "suggested" && parseAmount(budget.limit) === 0;
}

function confidenceLabel(confidence: SuggestionConfidence | undefined): string {
  if (confidence === "high") return "High confidence";
  if (confidence === "medium") return "Medium confidence";
  if (confidence === "low") return "Low confidence";
  return "";
}

interface FormModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function FormModal({ title, onClose, children }: FormModalProps) {
  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-lg"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="planning-form-title"
        >
          <h3 id="planning-form-title" className="text-base font-bold text-text">
            {title}
          </h3>
          <div className="mt-4 space-y-4">{children}</div>
        </div>
      </div>
    </ModalPortal>
  );
}

interface BudgetFormState {
  category: string;
  limit: string;
}

interface GoalFormState {
  name: string;
  target: string;
  current: string;
  deadline: string;
  emoji: string;
  color: string;
  kind: GoalKind;
}

function BudgetSuggestions({
  suggestions,
  periodMonth,
  dismissedCategories,
  onAccept,
  onDismiss,
  isPending,
}: {
  suggestions: BudgetItem[];
  periodMonth: string;
  dismissedCategories: Set<string>;
  onAccept: (s: BudgetItem) => void;
  onDismiss: (s: BudgetItem) => void;
  isPending: boolean;
}) {
  const visible = suggestions.filter((s) => !dismissedCategories.has(s.category));
  if (visible.length === 0) return null;

  const essential = visible.filter((s) => s.class === "essential");
  const discretionary = visible.filter((s) => s.class !== "essential");

  const renderGroup = (title: string, items: BudgetItem[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          {title}
        </p>
        {items.map((s) => (
          <div
            key={s.category}
            className="rounded-[var(--radius-md)] border border-primary/30 bg-primary-soft/30 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-text">
                  {s.emoji ?? "💸"} {s.category}
                </p>
                {s.rationale ? (
                  <p className="mt-1 text-xs text-text-muted">{s.rationale}</p>
                ) : null}
                {s.confidence ? (
                  <p className="mt-1 text-[10px] font-medium text-primary">
                    {confidenceLabel(s.confidence)}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 text-sm font-bold tabular-nums text-text">
                {formatMoney(s.limit)}/mo
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => onAccept(s)}
                className="flex-1 rounded-[var(--radius-sm)] bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Add budget
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => onDismiss(s)}
                className="rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <p className="px-1 text-xs font-semibold text-text">Suggested for {periodMonth}</p>
      {renderGroup("Essential", essential)}
      {renderGroup("Discretionary", discretionary)}
    </div>
  );
}

function GoalSuggestions({
  suggestions,
  onAccept,
  onEdit,
  onDismiss,
  isPending,
}: {
  suggestions: GoalItem[];
  onAccept: (g: GoalItem) => void;
  onEdit: (g: GoalItem) => void;
  onDismiss: (g: GoalItem) => void;
  isPending: boolean;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-semibold text-text">Suggested goals</p>
      {suggestions.map((g) => (
        <div
          key={`${g.kind}-${g.name}`}
          className="rounded-[var(--radius-md)] border border-primary/30 bg-primary-soft/30 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text">
                {g.emoji ?? "🎯"} {g.name}
              </p>
              {g.rationale ? (
                <p className="mt-1 text-xs text-text-muted">{g.rationale}</p>
              ) : null}
              {g.monthlySetAside ? (
                <p className="mt-1 text-[11px] text-text-muted">
                  Suggested set-aside: {formatMoney(g.monthlySetAside)}/mo
                </p>
              ) : null}
            </div>
            <p className="shrink-0 text-right text-sm font-bold tabular-nums text-text">
              {formatMoney(g.target)}
            </p>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => onAccept(g)}
              className="flex-1 rounded-[var(--radius-sm)] bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Accept
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onEdit(g)}
              className="rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text disabled:opacity-50"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onDismiss(g)}
              className="rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BudgetsPanel() {
  const [activeTab, setActiveTab] = useState<"budgets" | "goals">("budgets");
  const [budgetModal, setBudgetModal] = useState<
    | { mode: "add" }
    | { mode: "edit"; budget: BudgetItem }
    | null
  >(null);
  const [goalModal, setGoalModal] = useState<
    | { mode: "add" }
    | { mode: "edit"; goal: GoalItem }
    | { mode: "suggest"; goal: GoalItem }
    | null
  >(null);
  const [formError, setFormError] = useState<string | null>(null);

  const gate = useFeaturePanelGate("budgets and goals");
  const { data, isLoading } = useBudgets();
  const { data: categoriesData } = useCategories();
  const upsertBudget = useUpsertBudget();
  const patchBudget = usePatchBudget();
  const deleteBudget = useDeleteBudget();
  const createGoal = useCreateGoal();
  const patchGoal = usePatchGoal();
  const deleteGoal = useDeleteGoal();

  const categoryOptions = useMemo(
    () => (categoriesData?.categories ?? []).map((c) => c.name),
    [categoriesData],
  );

  const dismissedCategories = useMemo(() => {
    const set = new Set<string>();
    for (const b of data?.budgets ?? []) {
      if (isDismissedBudget(b)) set.add(b.category);
    }
    return set;
  }, [data?.budgets]);

  const budgets = useMemo(
    () =>
      (data?.budgets ?? [])
        .filter((b) => !isDismissedBudget(b))
        .map((b) => ({
          ...b,
          spent: parseAmount(b.spent),
          limit: parseAmount(b.limit),
          color: b.color ?? DEFAULT_BUDGET_COLOR,
          emoji: b.emoji ?? "💸",
        })),
    [data?.budgets],
  );

  const goals = useMemo(
    () =>
      (data?.goals ?? []).map((g) => ({
        ...g,
        target: parseAmount(g.target),
        current: parseAmount(g.current),
        color: g.color ?? DEFAULT_GOAL_COLOR,
        emoji: g.emoji ?? "🎯",
        deadline: g.deadline ?? "—",
      })),
    [data?.goals],
  );

  const suggestedBudgets = data?.suggestedBudgets ?? [];
  const suggestedGoals = data?.suggestedGoals ?? [];

  const mutationPending =
    upsertBudget.isPending ||
    patchBudget.isPending ||
    deleteBudget.isPending ||
    createGoal.isPending ||
    patchGoal.isPending ||
    deleteGoal.isPending;

  if (!gate.ready) return gate.node;
  if (isLoading) return <FeaturePanelLoading />;

  const hasContent =
    budgets.length > 0 ||
    goals.length > 0 ||
    suggestedBudgets.some((s) => !dismissedCategories.has(s.category)) ||
    suggestedGoals.length > 0;

  if (!hasContent) {
    return (
      <FeatureEmptyState feature="budgets and goals" variant="insufficient-data" />
    );
  }

  const safeToSpend = data ? parseAmount(data.safeToSpend) : 0;
  const daysRemaining = data?.daysRemaining ?? 0;
  const periodMonth = data?.periodMonth ?? "";
  const totalBudget = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);

  const openAddBudget = () => {
    setFormError(null);
    setBudgetModal({ mode: "add" });
  };

  const openEditBudget = (budget: (typeof budgets)[number]) => {
    setFormError(null);
    setBudgetModal({
      mode: "edit",
      budget: {
        ...budget,
        spent: String(budget.spent),
        limit: String(budget.limit),
      },
    });
  };

  const openAddGoal = () => {
    setFormError(null);
    setGoalModal({ mode: "add" });
  };

  const openEditGoal = (goal: (typeof goals)[number]) => {
    setFormError(null);
    setGoalModal({
      mode: "edit",
      goal: {
        ...goal,
        target: String(goal.target),
        current: String(goal.current),
        deadline: goal.deadline === "—" ? null : goal.deadline,
      },
    });
  };

  const handleAcceptBudgetSuggestion = (s: BudgetItem) => {
    if (!periodMonth) return;
    upsertBudget.mutate({
      category: s.category,
      periodMonth,
      limit: parseAmount(s.limit),
      emoji: s.emoji ?? undefined,
      color: s.color ?? undefined,
      source: "user",
      class: (s.class as BudgetClass | undefined) ?? undefined,
    });
  };

  const handleDismissBudgetSuggestion = (s: BudgetItem) => {
    if (!periodMonth) return;
    upsertBudget.mutate({
      category: s.category,
      periodMonth,
      limit: 0,
      source: "suggested",
    });
  };

  const handleAcceptGoalSuggestion = (g: GoalItem) => {
    createGoal.mutate({
      name: g.name,
      target: parseAmount(g.target),
      current: parseAmount(g.current),
      deadline: g.deadline,
      emoji: g.emoji ?? undefined,
      color: g.color ?? undefined,
      kind: g.kind,
      status: "active",
      source: "user",
      accountId: g.accountId,
    });
  };

  const handleDismissGoalSuggestion = (g: GoalItem) => {
    createGoal.mutate({
      name: g.name,
      target: parseAmount(g.target),
      current: parseAmount(g.current),
      deadline: g.deadline,
      emoji: g.emoji ?? undefined,
      color: g.color ?? undefined,
      kind: g.kind,
      status: "dismissed",
      source: "suggested",
      accountId: g.accountId,
    });
  };

  const submitBudgetForm = (form: BudgetFormState) => {
    const limit = Number.parseFloat(form.limit);
    if (!form.category.trim() || Number.isNaN(limit) || limit < 0) {
      setFormError("Enter a category and a valid monthly limit.");
      return;
    }
    if (!periodMonth) return;

    if (budgetModal?.mode === "edit" && budgetModal.budget.id) {
      patchBudget.mutate(
        { budgetId: budgetModal.budget.id, body: { limit } },
        { onSuccess: () => setBudgetModal(null) },
      );
      return;
    }

    upsertBudget.mutate(
      {
        category: form.category.trim(),
        periodMonth,
        limit,
        source: "user",
      },
      { onSuccess: () => setBudgetModal(null) },
    );
  };

  const submitGoalForm = (form: GoalFormState) => {
    const target = Number.parseFloat(form.target);
    const current = Number.parseFloat(form.current);
    if (!form.name.trim() || Number.isNaN(target) || target < 0) {
      setFormError("Enter a goal name and valid target amount.");
      return;
    }

    const deadline = form.deadline.trim() || null;
    const payload = {
      name: form.name.trim(),
      target,
      current: Number.isNaN(current) ? 0 : current,
      deadline,
      emoji: form.emoji || undefined,
      color: form.color || undefined,
      kind: form.kind,
    };

    if (goalModal?.mode === "edit" && goalModal.goal.id) {
      patchGoal.mutate(
        { goalId: goalModal.goal.id, body: payload },
        { onSuccess: () => setGoalModal(null) },
      );
      return;
    }

    createGoal.mutate(
      {
        ...payload,
        status: "active",
        source: goalModal?.mode === "suggest" ? "user" : "user",
        accountId: goalModal?.mode === "suggest" ? goalModal.goal.accountId : undefined,
      },
      { onSuccess: () => setGoalModal(null) },
    );
  };

  const initialBudgetForm: BudgetFormState =
    budgetModal?.mode === "edit"
      ? {
          category: budgetModal.budget.category,
          limit: String(budgetModal.budget.limit),
        }
      : { category: "", limit: "" };

  const initialGoalForm: GoalFormState =
    goalModal && goalModal.mode !== "add"
      ? {
          name: goalModal.goal.name,
          target: String(
            goalModal.mode === "edit"
              ? goalModal.goal.target
              : parseAmount(goalModal.goal.target),
          ),
          current: String(
            goalModal.mode === "edit"
              ? goalModal.goal.current
              : parseAmount(goalModal.goal.current),
          ),
          deadline:
            goalModal.goal.deadline && goalModal.goal.deadline !== "—"
              ? goalModal.goal.deadline
              : "",
          emoji: goalModal.goal.emoji ?? "🎯",
          color: goalModal.goal.color ?? DEFAULT_GOAL_COLOR,
          kind: goalModal.goal.kind ?? "custom",
        }
      : {
          name: "",
          target: "",
          current: "0",
          deadline: "",
          emoji: "🎯",
          color: DEFAULT_GOAL_COLOR,
          kind: "custom",
        };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <MetricLiveBadge isLive={data?.isLive ?? false} />
      </div>

      <div
        className="relative overflow-hidden rounded-[var(--radius-lg)] p-5"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="relative z-10">
          <p className="text-sm font-medium text-white/70">Safe to spend today</p>
          <p className="mt-1 text-5xl font-extrabold tracking-tight text-white tabular-nums">
            {formatMoney(String(safeToSpend))}
          </p>
          <p className="mt-1.5 text-sm text-white/70">
            After bills, goals & commitments — resets Friday
          </p>
          <div className="mt-4 flex gap-6">
            <div>
              <p className="text-xs text-white/60">Monthly budget</p>
              <p className="text-base font-bold text-white tabular-nums">
                {formatMoney(String(totalBudget))}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/60">Spent so far</p>
              <p className="text-base font-bold text-white tabular-nums">
                {formatMoney(String(totalSpent))}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/60">Days remaining</p>
              <p className="text-base font-bold text-white">{daysRemaining}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 rounded-[var(--radius-sm)] bg-surface-raised p-1">
        {(["budgets", "goals"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-[var(--radius-sm)] py-1.5 text-sm font-semibold capitalize transition-all ${
              activeTab === tab
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            {tab === "budgets" ? "Category Budgets" : "Savings Goals"}
          </button>
        ))}
      </div>

      {activeTab === "budgets" && (
        <div className="space-y-3">
          <BudgetSuggestions
            suggestions={suggestedBudgets}
            periodMonth={periodMonth}
            dismissedCategories={dismissedCategories}
            onAccept={handleAcceptBudgetSuggestion}
            onDismiss={handleDismissBudgetSuggestion}
            isPending={mutationPending}
          />

          {budgets.map((b) => {
            const pct = b.limit > 0 ? Math.min((b.spent / b.limit) * 100, 100) : 0;
            const over = b.spent > b.limit;
            return (
              <div
                key={b.id ?? b.category}
                className="rounded-[var(--radius-md)] border border-border bg-surface p-4"
              >
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-base">{b.emoji}</span>
                    <span className="truncate text-sm font-semibold text-text">
                      {b.category}
                    </span>
                    {over ? (
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                        Over budget
                      </span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      <span
                        className={`text-sm font-bold tabular-nums ${over ? "text-danger" : "text-text"}`}
                      >
                        {formatMoney(String(b.spent))}
                      </span>
                      <span className="text-xs text-text-muted">
                        {" "}
                        / {formatMoney(String(b.limit))}
                      </span>
                    </div>
                    {b.id ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEditBudget(b)}
                          className="rounded px-2 py-1 text-[10px] font-semibold text-text-muted hover:bg-bg hover:text-text"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={mutationPending}
                          onClick={() => deleteBudget.mutate(b.id!)}
                          className="rounded px-2 py-1 text-[10px] font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: over ? "#ef4444" : b.color,
                    }}
                  />
                </div>
                <p className="mt-1 text-right text-[11px] text-text-muted">
                  {over
                    ? `${formatMoney(String(b.spent - b.limit))} over`
                    : `${formatMoney(String(b.limit - b.spent))} left`}
                </p>
              </div>
            );
          })}

          <button
            type="button"
            onClick={openAddBudget}
            className="w-full rounded-[var(--radius-md)] border border-dashed border-border py-3 text-sm text-text-muted transition hover:border-primary hover:text-primary"
          >
            + Add category budget
          </button>
        </div>
      )}

      {activeTab === "goals" && (
        <div className="space-y-3">
          <GoalSuggestions
            suggestions={suggestedGoals}
            onAccept={handleAcceptGoalSuggestion}
            onEdit={(g) => {
              setFormError(null);
              setGoalModal({ mode: "suggest", goal: g });
            }}
            onDismiss={handleDismissGoalSuggestion}
            isPending={mutationPending}
          />

          {goals.map((g) => {
            const pct = g.target > 0 ? Math.min((g.current / g.target) * 100, 100) : 0;
            return (
              <div
                key={g.id ?? g.name}
                className="rounded-[var(--radius-md)] border border-border bg-surface p-4"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-xl">{g.emoji}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text">{g.name}</p>
                      <p className="text-xs text-text-muted">Target: {g.deadline}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-text">
                        {formatMoney(String(g.current))}
                      </p>
                      <p className="text-xs text-text-muted">
                        of {formatMoney(String(g.target))}
                      </p>
                    </div>
                    {g.id ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEditGoal(g)}
                          className="rounded px-2 py-1 text-[10px] font-semibold text-text-muted hover:bg-bg hover:text-text"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={mutationPending}
                          onClick={() => deleteGoal.mutate(g.id!)}
                          className="rounded px-2 py-1 text-[10px] font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: g.color }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-text-muted">
                  <span>{pct.toFixed(0)}% complete</span>
                  <span>{formatMoney(String(g.target - g.current))} to go</span>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={openAddGoal}
            className="w-full rounded-[var(--radius-md)] border border-dashed border-border py-3 text-sm text-text-muted transition hover:border-primary hover:text-primary"
          >
            + Add savings goal
          </button>
        </div>
      )}

      {budgetModal ? (
        <BudgetFormModal
          key={budgetModal.mode === "edit" ? budgetModal.budget.id : "add"}
          title={budgetModal.mode === "edit" ? "Edit budget" : "Add category budget"}
          initial={initialBudgetForm}
          categoryOptions={categoryOptions}
          readOnlyCategory={budgetModal.mode === "edit"}
          error={formError}
          isPending={mutationPending}
          onClose={() => setBudgetModal(null)}
          onSubmit={submitBudgetForm}
        />
      ) : null}

      {goalModal ? (
        <GoalFormModal
          key={
            goalModal.mode === "add"
              ? "add"
              : goalModal.mode === "edit"
                ? goalModal.goal.id
                : `suggest-${goalModal.goal.name}`
          }
          title={
            goalModal.mode === "edit"
              ? "Edit savings goal"
              : goalModal.mode === "suggest"
                ? "Edit before accepting"
                : "Add savings goal"
          }
          initial={initialGoalForm}
          error={formError}
          isPending={mutationPending}
          onClose={() => setGoalModal(null)}
          onSubmit={submitGoalForm}
        />
      ) : null}
    </div>
  );
}

function BudgetFormModal({
  title,
  initial,
  categoryOptions,
  readOnlyCategory,
  error,
  isPending,
  onClose,
  onSubmit,
}: {
  title: string;
  initial: BudgetFormState;
  categoryOptions: string[];
  readOnlyCategory: boolean;
  error: string | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (form: BudgetFormState) => void;
}) {
  const [form, setForm] = useState(initial);

  return (
    <FormModal title={title} onClose={onClose}>
      <label className="block text-xs font-medium text-text-muted">
        Category
        {readOnlyCategory ? (
          <p className="mt-1 text-sm text-text">{form.category}</p>
        ) : (
          <select
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2 text-sm text-text"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="">Select a category…</option>
            {categoryOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </label>
      <label className="block text-xs font-medium text-text-muted">
        Monthly limit
        <input
          type="number"
          min="0"
          step="1"
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2 text-sm tabular-nums text-text"
          value={form.limit}
          onChange={(e) => setForm((f) => ({ ...f, limit: e.target.value }))}
        />
      </label>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={isPending}
          onClick={() => onSubmit(form)}
          className="flex-1 rounded-[var(--radius-sm)] bg-primary py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-[var(--radius-sm)] border border-border px-4 py-2 text-sm font-semibold text-text-muted"
        >
          Cancel
        </button>
      </div>
    </FormModal>
  );
}

function GoalFormModal({
  title,
  initial,
  error,
  isPending,
  onClose,
  onSubmit,
}: {
  title: string;
  initial: GoalFormState;
  error: string | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (form: GoalFormState) => void;
}) {
  const [form, setForm] = useState(initial);

  return (
    <FormModal title={title} onClose={onClose}>
      <label className="block text-xs font-medium text-text-muted">
        Goal name
        <input
          type="text"
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2 text-sm text-text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-text-muted">
          Target
          <input
            type="number"
            min="0"
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2 text-sm tabular-nums text-text"
            value={form.target}
            onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
          />
        </label>
        <label className="block text-xs font-medium text-text-muted">
          Current saved
          <input
            type="number"
            min="0"
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2 text-sm tabular-nums text-text"
            value={form.current}
            onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
          />
        </label>
      </div>
      <label className="block text-xs font-medium text-text-muted">
        Deadline (optional)
        <input
          type="date"
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2 text-sm text-text"
          value={form.deadline}
          onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
        />
      </label>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={isPending}
          onClick={() => onSubmit(form)}
          className="flex-1 rounded-[var(--radius-sm)] bg-primary py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-[var(--radius-sm)] border border-border px-4 py-2 text-sm font-semibold text-text-muted"
        >
          Cancel
        </button>
      </div>
    </FormModal>
  );
}
