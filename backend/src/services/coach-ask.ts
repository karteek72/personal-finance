import {
  buildMonthlySummary,
} from "./compute-wellness.js";
import { detectRecurringFromTransactions } from "./detect-recurring.js";
import { formatMoneyAmount } from "../lib/money.js";
import { resolveHouseholdContext } from "./household-access.js";
import { getBudgets } from "./planning-store.js";
import { getCategories } from "./transaction-store.js";

export interface CoachAskResponse {
  answer: string;
  isLive: boolean;
}

/** Rule-based coach answers from live transaction summaries (no LLM). */
export async function askCoach(
  userId: string,
  question: string,
): Promise<CoachAskResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const q = question.trim().toLowerCase();
  if (!q) {
    return { answer: "Ask me a question about your spending, savings, or subscriptions.", isLive: false };
  }

  const summary = await buildMonthlySummary(ctx.userIds);
  const hasData =
    Number.parseFloat(summary.spending) > 0 ||
    Number.parseFloat(summary.income) > 0;

  if (!hasData) {
    return {
      answer:
        "Connect accounts and sync transactions first — then I can answer questions about your real spending.",
      isLive: false,
    };
  }

  const { start, end } = (() => {
    const period = summary.period;
    const [y, mo] = period.split("-").map(Number);
    const lastDay = new Date(y!, mo!, 0).getDate();
    return {
      start: `${period}-01`,
      end: `${period}-${String(lastDay).padStart(2, "0")}`,
    };
  })();

  const categories = await getCategories(ctx.userIds, start, end);

  const savingsRatePct = (summary.savingsRate * 100).toFixed(1);

  if (/food|delivery|dining|restaurant|doordash|uber eats|grubhub/.test(q)) {
    const dining =
      categories.categories.find((c) =>
        /dining|food|delivery/i.test(c.name),
      ) ?? categories.categories[0];
    const amt = dining?.amount ?? "0.00";
    return {
      answer: `This month you've spent **${amt}** on ${dining?.name ?? "food & dining"}. Total spending is **${summary.spending}** with a **${savingsRatePct}%** savings rate.`,
      isLive: true,
    };
  }

  if (/emergency|goal|save|saving|fund/.test(q)) {
    const budgets = await getBudgets(userId);
    const goalText =
      budgets.goals.length > 0
        ? budgets.goals
            .map(
              (g) =>
                `**${g.name}**: ${g.current} of ${g.target}${g.deadline ? ` (by ${g.deadline})` : ""}`,
            )
            .join("; ")
        : "No savings goals set yet.";
    return {
      answer: `Your savings rate this month is **${savingsRatePct}%**. Safe to spend today: **${budgets.safeToSpend}**. Goals: ${goalText}`,
      isLive: true,
    };
  }

  if (/subscription|recurring|waste|biggest|cancel/.test(q)) {
    const detected = await detectRecurringFromTransactions(ctx.userIds);
    const subs = detected.filter((d) => d.kind === "subscription");
    if (subs.length === 0) {
      return {
        answer: `I didn't detect recurring subscriptions yet (need ≥3 monthly charges per merchant). Total spending this month: **${summary.spending}**.`,
        isLive: true,
      };
    }
    const top = subs.slice(0, 5);
    const monthly = subs.reduce(
      (s, r) => s + Number.parseFloat(r.amount),
      0,
    );
    const list = top
      .map((s) => `**${s.merchantName}** (${formatMoneyAmount(s.amount)}/mo)`)
      .join(", ");
    return {
      answer: `You have **${subs.length}** detected subscriptions totaling **${formatMoneyAmount(monthly)}/mo** (~**${formatMoneyAmount(monthly * 12)}/yr**). Top: ${list}.`,
      isLive: true,
    };
  }

  if (/spent|spend|how much|total/.test(q)) {
    return {
      answer: `This month (${summary.period}): spent **${summary.spending}**, earned **${summary.income}**, savings rate **${savingsRatePct}%**. Top category: **${summary.topCategory?.name ?? "N/A"}** at **${summary.topCategory?.amount ?? "$0.00"}**.`,
      isLive: true,
    };
  }

  return {
    answer: `Based on ${summary.period}: you spent **${summary.spending}** and saved **${savingsRatePct}%** of **${summary.income}** income. Ask about food delivery, subscriptions, goals, or total spending for more detail.`,
    isLive: true,
  };
}
