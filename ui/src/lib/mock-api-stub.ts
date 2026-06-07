/**
 * Production stub — webpack aliases mock-api here when NEXT_PUBLIC_USE_MOCKS !== "true".
 */

function mocksDisabled(): never {
  throw new Error(
    "Mock API is not available in production builds. Set NEXT_PUBLIC_USE_MOCKS=true only for local dev.",
  );
}

const fn = mocksDisabled;

export const getSummary = fn;
export const updateTransactionCategory = fn;
export const getTransactions = fn;
export const getAccounts = fn;
export const getCreditDebtSummary = fn;
export const deleteAccount = fn;
export const syncAccount = fn;
export const syncAllPlaid = fn;
export const getAlerts = fn;
export const getCategories = fn;
export const getMoneyFlow = fn;
export const getTrends = fn;
export const getChartData = fn;
export const getHousehold = fn;
export const updateHouseholdName = fn;
export const getHouseholdInsights = fn;
export const createHouseholdMember = fn;
export const updateHouseholdMember = fn;
export const deleteHouseholdMember = fn;
export const assignAccountToMember = fn;
export const inviteHouseholdMember = fn;
export const revokeHouseholdInvite = fn;
export const previewHouseholdInvite = fn;
export const acceptHouseholdInvite = fn;
export const getNetWorth = fn;
export const getInvestments = fn;
export const getBudgets = fn;
export const upsertBudget = fn;
export const patchBudget = fn;
export const deleteBudget = fn;
export const createGoal = fn;
export const patchGoal = fn;
export const deleteGoal = fn;
export const getRecurring = fn;
export const getUserProfile = fn;
export const patchUserProfile = fn;
export const getAnalyticsProfile = fn;
export const patchAnalyticsProfile = fn;
export const getFire = fn;
export const patchFire = fn;
export const getWellness = fn;
export const getDna = fn;
export const getPatterns = fn;
export const getBehavioral = fn;
export const getInflation = fn;
export const getResilience = fn;
export const getCoach = fn;
export const getWrapped = fn;
export const getMerchants = fn;
export const getMerchantsTable = fn;
export const getCalendar = fn;
export const getForecast = fn;
