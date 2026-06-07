import { asc, inArray } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  inflationCategories,
  inflationProfiles,
  resilienceProfiles,
  resilienceScenarios,
} from "../db/schema.js";
import { formatMoneyAmount, roundDecimal } from "../lib/money.js";
import {
  paginateInMemory,
  type Page,
  type ParsedListQuery,
} from "../lib/list-query.js";
import { refreshProtectProfiles } from "./protect-analytics.js";
import { resolveHouseholdContext } from "./household-access.js";

export interface InflationCategoryRow {
  name: string;
  share: number;
  inflation: number;
  severity: string;
}

export const INFLATION_CATEGORY_SORTABLE = [
  "name",
  "share",
  "inflation",
  "severity",
] as const;

export interface InflationResponse {
  personalRate: number;
  nationalCpi: number;
  salaryRaise: number;
  nominalSavingsRate: number;
  realSavingsRate: number;
  realRaise: number;
  powerLoss: string;
  salary: string;
  breakEvenSalary: string;
  targetSalary: string;
  categories: Page<InflationCategoryRow>;
}

function inflationCategorySortKey(
  column: string,
): (row: InflationCategoryRow) => number | string {
  switch (column) {
    case "name":
      return (r) => r.name.toLowerCase();
    case "share":
      return (r) => r.share;
    case "inflation":
      return (r) => r.inflation;
    case "severity":
      return (r) => r.severity;
    default:
      return (r) => r.share;
  }
}

export async function getInflation(
  userId: string,
  q: ParsedListQuery,
): Promise<InflationResponse | null> {
  const ctx = await resolveHouseholdContext(userId);
  await refreshProtectProfiles(userId);
  const db = getDb();
  const [profile] = await db
    .select()
    .from(inflationProfiles)
    .where(inArray(inflationProfiles.userId, ctx.userIds))
    .limit(1);
  if (!profile) {
    return null;
  }
  const cats = await db
    .select()
    .from(inflationCategories)
    .where(inArray(inflationCategories.userId, ctx.userIds))
    .orderBy(asc(inflationCategories.sortOrder));

  const personal = Number.parseFloat(profile.personalRate);
  const salary = Number.parseFloat(profile.salary);
  const nominalSavings = Number.parseFloat(profile.nominalSavingsRate);
  const raise = Number.parseFloat(profile.raisePercent);

  const allCategories: InflationCategoryRow[] = cats.map((c) => ({
    name: c.name,
    share: roundDecimal(Number.parseFloat(c.share)),
    inflation: roundDecimal(Number.parseFloat(c.inflationRate)),
    severity: c.severity,
  }));

  return {
    personalRate: roundDecimal(personal),
    nationalCpi: roundDecimal(Number.parseFloat(profile.nationalCpi)),
    salaryRaise: roundDecimal(raise),
    nominalSavingsRate: roundDecimal(nominalSavings),
    realSavingsRate: roundDecimal(nominalSavings - personal),
    realRaise: roundDecimal(raise - personal),
    powerLoss: formatMoneyAmount(profile.powerLoss ?? "0"),
    salary: formatMoneyAmount(salary),
    breakEvenSalary: formatMoneyAmount(salary * (1 + personal / 100)),
    targetSalary: formatMoneyAmount(salary * (1 + (personal + 5) / 100)),
    categories: paginateInMemory(allCategories, q, {
      sortKey: inflationCategorySortKey,
      textFilter: (row, needle) => row.name.toLowerCase().includes(needle),
    }),
  };
}

export interface ResilienceResponse {
  liquidCash: string;
  monthlyBurn: string;
  runwayMonths: number;
  immunityScore: number;
  scenarios: Array<{
    id: string;
    name: string;
    emoji: string | null;
    shockAmount: string;
    shockType: string;
    monthsCovered: number;
    recommendedMonths: number;
    detail: string | null;
  }>;
}

export async function getResilience(
  userId: string,
): Promise<ResilienceResponse | null> {
  const ctx = await resolveHouseholdContext(userId);
  await refreshProtectProfiles(userId);
  const db = getDb();
  const [profile] = await db
    .select()
    .from(resilienceProfiles)
    .where(inArray(resilienceProfiles.userId, ctx.userIds))
    .limit(1);
  if (!profile) {
    return null;
  }
  const scenarios = await db
    .select()
    .from(resilienceScenarios)
    .where(inArray(resilienceScenarios.userId, ctx.userIds))
    .orderBy(asc(resilienceScenarios.sortOrder));

  const liquidCash = Number.parseFloat(profile.liquidCash);
  const monthlyBurn = Number.parseFloat(profile.monthlyBurn);
  const runwayMonths = monthlyBurn > 0 ? roundDecimal(liquidCash / monthlyBurn) : 0;
  const immunityScore = Math.min(100, Math.round((runwayMonths / 6) * 100));

  return {
    liquidCash: formatMoneyAmount(liquidCash),
    monthlyBurn: formatMoneyAmount(monthlyBurn),
    runwayMonths,
    immunityScore,
    scenarios: scenarios.map((s, i) => {
      const shock = Number.parseFloat(s.shockAmount);
      const monthsCovered =
        s.shockType === "recurring"
          ? roundDecimal(liquidCash / (monthlyBurn + shock))
          : roundDecimal(liquidCash / shock);
      return {
        id: `scenario-${i}`,
        name: s.name,
        emoji: s.emoji,
        shockAmount: formatMoneyAmount(shock),
        shockType: s.shockType,
        monthsCovered,
        recommendedMonths: roundDecimal(Number.parseFloat(s.recommendedMonths)),
        detail: s.detail,
      };
    }),
  };
}
