import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { budgets, savingsGoals } from "../../db/schema.js";
import { AppError } from "../../lib/errors.js";
import { formatMoneyAmount } from "../../lib/money.js";
import { categoryMeta } from "../category-meta.js";
import { resolveHouseholdContext } from "../household-access.js";

export const BUDGET_SOURCE_VALUES = ["user", "suggested"] as const;
export const BUDGET_CLASS_VALUES = ["essential", "discretionary"] as const;
export const GOAL_KIND_VALUES = [
  "emergency",
  "debt",
  "sinking",
  "surplus",
  "custom",
] as const;
export const GOAL_STATUS_VALUES = ["active", "achieved", "dismissed"] as const;
export const GOAL_SOURCE_VALUES = ["user", "suggested"] as const;

export type BudgetSource = (typeof BUDGET_SOURCE_VALUES)[number];
export type BudgetClass = (typeof BUDGET_CLASS_VALUES)[number];
export type GoalKind = (typeof GOAL_KIND_VALUES)[number];
export type GoalStatus = (typeof GOAL_STATUS_VALUES)[number];
export type GoalSource = (typeof GOAL_SOURCE_VALUES)[number];

export interface BudgetRowResponse {
  id: string;
  category: string;
  periodMonth: string;
  emoji: string | null;
  color: string | null;
  limit: string;
  source: BudgetSource;
  class: BudgetClass | null;
}

export interface GoalRowResponse {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  target: string;
  current: string;
  deadline: string | null;
  kind: GoalKind;
  status: GoalStatus;
  source: GoalSource;
  accountId: string | null;
}

export interface UpsertBudgetInput {
  category: string;
  periodMonth: string;
  limit: number;
  emoji?: string;
  color?: string;
  source?: BudgetSource;
  class?: BudgetClass;
}

export interface PatchBudgetInput {
  limit?: number;
  emoji?: string | null;
  color?: string | null;
  class?: BudgetClass | null;
}

export interface CreateGoalInput {
  name: string;
  target: number;
  current?: number;
  deadline?: string | null;
  emoji?: string;
  color?: string;
  kind?: GoalKind;
  status?: GoalStatus;
  source?: GoalSource;
  accountId?: string | null;
}

export interface PatchGoalInput {
  name?: string;
  target?: number;
  current?: number;
  deadline?: string | null;
  emoji?: string | null;
  color?: string | null;
  kind?: GoalKind;
  status?: GoalStatus;
  accountId?: string | null;
}

function toBudgetResponse(row: typeof budgets.$inferSelect): BudgetRowResponse {
  return {
    id: row.id,
    category: row.category,
    periodMonth: row.periodMonth,
    emoji: row.emoji,
    color: row.color,
    limit: formatMoneyAmount(row.limitAmount),
    source: row.source as BudgetSource,
    class: (row.class as BudgetClass | null) ?? null,
  };
}

function toGoalResponse(row: typeof savingsGoals.$inferSelect): GoalRowResponse {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    color: row.color,
    target: formatMoneyAmount(row.targetAmount),
    current: formatMoneyAmount(row.currentAmount),
    deadline: row.deadline,
    kind: row.kind as GoalKind,
    status: row.status as GoalStatus,
    source: row.source as GoalSource,
    accountId: row.accountId,
  };
}

async function getBudgetForHousehold(
  budgetId: string,
  userId: string,
): Promise<(typeof budgets.$inferSelect) | null> {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();
  const [row] = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.id, budgetId), inArray(budgets.userId, ctx.userIds)))
    .limit(1);
  return row ?? null;
}

async function getGoalForHousehold(
  goalId: string,
  userId: string,
): Promise<(typeof savingsGoals.$inferSelect) | null> {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();
  const [row] = await db
    .select()
    .from(savingsGoals)
    .where(
      and(eq(savingsGoals.id, goalId), inArray(savingsGoals.userId, ctx.userIds)),
    )
    .limit(1);
  return row ?? null;
}

export async function upsertBudget(
  userId: string,
  input: UpsertBudgetInput,
): Promise<BudgetRowResponse> {
  const meta = categoryMeta(input.category);
  const db = getDb();
  const [row] = await db
    .insert(budgets)
    .values({
      userId,
      category: input.category,
      periodMonth: input.periodMonth,
      limitAmount: formatMoneyAmount(input.limit),
      emoji: input.emoji ?? meta.emoji,
      color: input.color ?? meta.color,
      source: input.source ?? "user",
      class: input.class ?? null,
    })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.category, budgets.periodMonth],
      set: {
        limitAmount: formatMoneyAmount(input.limit),
        emoji: input.emoji ?? meta.emoji,
        color: input.color ?? meta.color,
        source: input.source ?? "user",
        class: input.class ?? null,
      },
    })
    .returning();

  if (!row) {
    throw AppError.internal();
  }
  return toBudgetResponse(row);
}

export async function patchBudget(
  userId: string,
  budgetId: string,
  input: PatchBudgetInput,
): Promise<BudgetRowResponse> {
  const existing = await getBudgetForHousehold(budgetId, userId);
  if (!existing) {
    throw AppError.notFound("Budget not found");
  }

  const db = getDb();
  const [row] = await db
    .update(budgets)
    .set({
      ...(input.limit != null
        ? { limitAmount: formatMoneyAmount(input.limit) }
        : {}),
      ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.class !== undefined ? { class: input.class } : {}),
    })
    .where(eq(budgets.id, budgetId))
    .returning();

  if (!row) {
    throw AppError.internal();
  }
  return toBudgetResponse(row);
}

export async function deleteBudget(
  userId: string,
  budgetId: string,
): Promise<{ id: string }> {
  const existing = await getBudgetForHousehold(budgetId, userId);
  if (!existing) {
    throw AppError.notFound("Budget not found");
  }

  const db = getDb();
  await db.delete(budgets).where(eq(budgets.id, budgetId));
  return { id: budgetId };
}

export async function createGoal(
  userId: string,
  input: CreateGoalInput,
): Promise<GoalRowResponse> {
  const db = getDb();
  const [row] = await db
    .insert(savingsGoals)
    .values({
      userId,
      name: input.name,
      targetAmount: formatMoneyAmount(input.target),
      currentAmount: formatMoneyAmount(input.current ?? 0),
      deadline: input.deadline ?? null,
      emoji: input.emoji ?? null,
      color: input.color ?? null,
      kind: input.kind ?? "custom",
      status: input.status ?? "active",
      source: input.source ?? "user",
      accountId: input.accountId ?? null,
    })
    .returning();

  if (!row) {
    throw AppError.internal();
  }
  return toGoalResponse(row);
}

export async function patchGoal(
  userId: string,
  goalId: string,
  input: PatchGoalInput,
): Promise<GoalRowResponse> {
  const existing = await getGoalForHousehold(goalId, userId);
  if (!existing) {
    throw AppError.notFound("Savings goal not found");
  }

  const db = getDb();
  const [row] = await db
    .update(savingsGoals)
    .set({
      ...(input.name != null ? { name: input.name } : {}),
      ...(input.target != null
        ? { targetAmount: formatMoneyAmount(input.target) }
        : {}),
      ...(input.current != null
        ? { currentAmount: formatMoneyAmount(input.current) }
        : {}),
      ...(input.deadline !== undefined ? { deadline: input.deadline } : {}),
      ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.kind != null ? { kind: input.kind } : {}),
      ...(input.status != null ? { status: input.status } : {}),
      ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
    })
    .where(eq(savingsGoals.id, goalId))
    .returning();

  if (!row) {
    throw AppError.internal();
  }
  return toGoalResponse(row);
}

export async function deleteGoal(
  userId: string,
  goalId: string,
): Promise<{ id: string }> {
  const existing = await getGoalForHousehold(goalId, userId);
  if (!existing) {
    throw AppError.notFound("Savings goal not found");
  }

  const db = getDb();
  await db.delete(savingsGoals).where(eq(savingsGoals.id, goalId));
  return { id: goalId };
}
