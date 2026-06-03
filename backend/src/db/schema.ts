import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    googleSub: text("google_sub"),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_google_sub_idx").on(table.googleSub),
  ],
);

export const plaidItems = pgTable("plaid_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  plaidItemId: text("plaid_item_id").notNull().unique(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  institutionId: text("institution_id"),
  institutionName: text("institution_name"),
  cursor: text("cursor"),
  status: text("status").notNull().default("active"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plaidItemId: uuid("plaid_item_id").references(() => plaidItems.id, {
      onDelete: "set null",
    }),
    plaidAccountId: text("plaid_account_id"),
    name: text("name").notNull(),
    officialName: text("official_name"),
    type: text("type").notNull(), // depository | credit
    subtype: text("subtype"),
    mask: text("mask").notNull(),
    institutionName: text("institution_name").notNull(),
    currencyCode: text("currency_code").notNull().default("USD"),
    source: text("source").notNull().default("import"), // import | plaid
    balanceCurrent: numeric("balance_current", { precision: 12, scale: 2 }),
    balanceAvailable: numeric("balance_available", { precision: 12, scale: 2 }),
    status: text("status").notNull().default("active"),
    isActive: boolean("is_active").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("accounts_plaid_account_id_idx").on(table.plaidAccountId),
  ],
);

export const creditCardLiabilities = pgTable("credit_card_liabilities", {
  accountId: uuid("account_id")
    .primaryKey()
    .references(() => accounts.id, { onDelete: "cascade" }),
  lastStatementBalance: numeric("last_statement_balance", {
    precision: 12,
    scale: 2,
  }),
  lastStatementIssueDate: date("last_statement_issue_date"),
  minimumPaymentAmount: numeric("minimum_payment_amount", {
    precision: 12,
    scale: 2,
  }),
  nextPaymentDueDate: date("next_payment_due_date"),
  lastPaymentAmount: numeric("last_payment_amount", {
    precision: 12,
    scale: 2,
  }),
  lastPaymentDate: date("last_payment_date"),
  isOverdue: boolean("is_overdue"),
  aprs: jsonb("aprs").notNull().default([]),
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    date: date("date").notNull(),
    name: text("name").notNull(),
    merchantName: text("merchant_name"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currencyCode: text("currency_code").notNull().default("USD"),
    category: text("category").notNull().default("Uncategorized"),
    subCategory: text("sub_category"),
    transactionType: text("transaction_type").notNull(), // expense | income | transfer
    isTransfer: boolean("is_transfer").notNull().default(false),
    pending: boolean("pending").notNull().default(false),
    source: text("source").notNull(), // qfx | bofa_pdf | csv | plaid
    dedupFingerprint: text("dedup_fingerprint"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("transactions_account_external_id_idx").on(
      table.accountId,
      table.externalId,
    ),
  ],
);

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const householdMembers = pgTable("household_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("other"), // owner | partner | child | other
  avatarColor: text("avatar_color").notNull().default("#7c3aed"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const householdAccountAssignments = pgTable(
  "household_account_assignments",
  {
    accountId: uuid("account_id")
      .primaryKey()
      .references(() => accounts.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "cascade" }),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const merchantCategoryRules = pgTable(
  "merchant_category_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    merchantKey: text("merchant_key").notNull(),
    category: text("category").notNull(),
    subCategory: text("sub_category"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("merchant_category_rules_user_merchant_idx").on(
      table.userId,
      table.merchantKey,
    ),
  ],
);

export const householdInvitations = pgTable("household_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  memberId: uuid("member_id")
    .notNull()
    .references(() => householdMembers.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  invitedByUserId: uuid("invited_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------------------------------------ *
 * Investments & retirement (brokerage / 401k / IRA / crypto)
 * ------------------------------------------------------------------ */

export const securities = pgTable("securities", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticker: text("ticker").notNull().unique(),
  name: text("name").notNull(),
  assetType: text("asset_type").notNull(), // equity | etf | mutual_fund | bond | crypto
  sector: text("sector"),
  currentPrice: numeric("current_price", { precision: 18, scale: 4 }).notNull(),
  currencyCode: text("currency_code").notNull().default("USD"),
  asOf: timestamp("as_of", { withTimezone: true }).notNull().defaultNow(),
});

export const holdings = pgTable(
  "holdings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    securityId: uuid("security_id")
      .notNull()
      .references(() => securities.id, { onDelete: "cascade" }),
    quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
    costBasis: numeric("cost_basis", { precision: 18, scale: 4 }).notNull(), // per unit
    institutionValue: numeric("institution_value", { precision: 14, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("holdings_account_security_idx").on(
      table.accountId,
      table.securityId,
    ),
  ],
);

export const investmentTransactions = pgTable(
  "investment_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    securityId: uuid("security_id").references(() => securities.id, {
      onDelete: "set null",
    }),
    externalId: text("external_id").notNull(),
    date: date("date").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(), // buy | sell | dividend | contribution | fee
    quantity: numeric("quantity", { precision: 20, scale: 8 }),
    price: numeric("price", { precision: 18, scale: 4 }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    fees: numeric("fees", { precision: 12, scale: 2 }).notNull().default("0"),
    dedupFingerprint: text("dedup_fingerprint"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("investment_txn_account_external_id_idx").on(
      table.accountId,
      table.externalId,
    ),
  ],
);

/* ------------------------------------------------------------------ *
 * Planning: net worth, budgets, goals, recurring, FIRE
 * ------------------------------------------------------------------ */

export const netWorthSnapshots = pgTable(
  "net_worth_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    month: text("month").notNull(), // YYYY-MM
    totalAssets: numeric("total_assets", { precision: 14, scale: 2 }).notNull(),
    totalLiabilities: numeric("total_liabilities", {
      precision: 14,
      scale: 2,
    }).notNull(),
    netWorth: numeric("net_worth", { precision: 14, scale: 2 }).notNull(),
    breakdown: jsonb("breakdown").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("net_worth_user_month_idx").on(table.userId, table.month),
  ],
);

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    periodMonth: text("period_month").notNull(), // YYYY-MM
    limitAmount: numeric("limit_amount", { precision: 12, scale: 2 }).notNull(),
    emoji: text("emoji"),
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("budgets_user_category_period_idx").on(
      table.userId,
      table.category,
      table.periodMonth,
    ),
  ],
);

export const savingsGoals = pgTable("savings_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  currentAmount: numeric("current_amount", {
    precision: 12,
    scale: 2,
  }).notNull(),
  deadline: date("deadline"),
  emoji: text("emoji"),
  color: text("color"),
  accountId: uuid("account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const recurringSeries = pgTable("recurring_series", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  merchantName: text("merchant_name").notNull(),
  category: text("category").notNull(),
  kind: text("kind").notNull().default("subscription"), // subscription | bill | income
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  cadence: text("cadence").notNull().default("monthly"), // weekly | monthly | annual
  nextChargeDate: date("next_charge_date"),
  lastChargeDate: date("last_charge_date"),
  previousAmount: numeric("previous_amount", { precision: 12, scale: 2 }),
  priceChanged: boolean("price_changed").notNull().default(false),
  status: text("status").notNull().default("active"), // active | cancelled
  brandColor: text("brand_color"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const fireProfiles = pgTable("fire_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  currentAge: integer("current_age").notNull(),
  currentNetWorth: numeric("current_net_worth", {
    precision: 14,
    scale: 2,
  }).notNull(),
  monthlySpend: numeric("monthly_spend", { precision: 12, scale: 2 }).notNull(),
  monthlyInvest: numeric("monthly_invest", {
    precision: 12,
    scale: 2,
  }).notNull(),
  withdrawalRate: numeric("withdrawal_rate", { precision: 5, scale: 2 }).notNull(),
  realReturn: numeric("real_return", { precision: 5, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------------------------------------ *
 * Insights & behavioral
 * ------------------------------------------------------------------ */

export const wellnessScores = pgTable(
  "wellness_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    periodMonth: text("period_month").notNull(), // YYYY-MM
    score: integer("score").notNull(),
    dimensions: jsonb("dimensions").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("wellness_user_period_idx").on(
      table.userId,
      table.periodMonth,
    ),
  ],
);

export const spendingDna = pgTable("spending_dna", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  archetype: text("archetype").notNull(),
  narrative: text("narrative").notNull(),
  peerRarity: text("peer_rarity"),
  axes: jsonb("axes").notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const spendingPatterns = pgTable("spending_patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // pattern | day_of_week
  label: text("label").notNull(),
  metric: text("metric"),
  description: text("description"),
  severity: text("severity"), // warning | neutral | positive
  sortOrder: integer("sort_order").notNull().default(0),
});

export const transactionReasons = pgTable("transaction_reasons", {
  transactionId: uuid("transaction_id")
    .primaryKey()
    .references(() => transactions.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reasonId: text("reason_id").notNull(), // need | treat | social | bored | stress | impulse
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const challenges = pgTable("challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  goal: text("goal").notNull(),
  progressPercent: integer("progress_percent").notNull().default(0),
  daysRemaining: integer("days_remaining").notNull().default(0),
  complete: boolean("complete").notNull().default(false),
  color: text("color"),
});

export const habitStreaks = pgTable("habit_streaks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  currentDays: integer("current_days").notNull().default(0),
  maxDays: integer("max_days").notNull().default(0),
  color: text("color"),
});

export const lifestyleHabits = pgTable("lifestyle_habits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  emoji: text("emoji"),
  label: text("label").notNull(),
  monthlyAmount: numeric("monthly_amount", {
    precision: 12,
    scale: 2,
  }).notNull(),
});

/* ------------------------------------------------------------------ *
 * Protect: inflation & resilience
 * ------------------------------------------------------------------ */

export const inflationProfiles = pgTable("inflation_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  personalRate: numeric("personal_rate", { precision: 5, scale: 2 }).notNull(),
  nationalCpi: numeric("national_cpi", { precision: 5, scale: 2 }).notNull(),
  salary: numeric("salary", { precision: 14, scale: 2 }).notNull(),
  raisePercent: numeric("raise_percent", { precision: 5, scale: 2 }).notNull(),
  nominalSavingsRate: numeric("nominal_savings_rate", {
    precision: 5,
    scale: 2,
  }).notNull(),
  powerLoss: numeric("power_loss", { precision: 14, scale: 2 }),
  baseDate: date("base_date"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const inflationCategories = pgTable("inflation_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  share: numeric("share", { precision: 5, scale: 2 }).notNull(),
  inflationRate: numeric("inflation_rate", { precision: 5, scale: 2 }).notNull(),
  severity: text("severity").notNull(), // high | medium | low
  sortOrder: integer("sort_order").notNull().default(0),
});

export const resilienceProfiles = pgTable("resilience_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  liquidCash: numeric("liquid_cash", { precision: 14, scale: 2 }).notNull(),
  monthlyBurn: numeric("monthly_burn", { precision: 12, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const resilienceScenarios = pgTable("resilience_scenarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  emoji: text("emoji"),
  shockAmount: numeric("shock_amount", { precision: 12, scale: 2 }).notNull(),
  shockType: text("shock_type").notNull().default("recurring"), // one_time | recurring
  recommendedMonths: numeric("recommended_months", {
    precision: 5,
    scale: 1,
  }).notNull(),
  detail: text("detail"),
  sortOrder: integer("sort_order").notNull().default(0),
});

/* ------------------------------------------------------------------ *
 * Coach & Wrapped
 * ------------------------------------------------------------------ */

export const coachInsights = pgTable("coach_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // narrative | qa | forecast
  periodMonth: text("period_month"),
  question: text("question"),
  answer: text("answer").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const wrappedSummaries = pgTable(
  "wrapped_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    totalSpent: numeric("total_spent", { precision: 14, scale: 2 }).notNull(),
    transactionCount: integer("transaction_count").notNull(),
    totalSaved: numeric("total_saved", { precision: 14, scale: 2 }).notNull(),
    savingsRate: numeric("savings_rate", { precision: 5, scale: 2 }).notNull(),
    peerPercentile: text("peer_percentile"),
    archetype: text("archetype"),
    topCategory: jsonb("top_category").notNull().default({}),
    personality: jsonb("personality").notNull().default({}),
    moments: jsonb("moments").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("wrapped_user_year_idx").on(table.userId, table.year),
  ],
);

/* ------------------------------------------------------------------ *
 * Statement import (encrypted uploads → worker parse)
 * ------------------------------------------------------------------ */

export const importBatches = pgTable("import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // pending | processing | awaiting_confirmation | completed | failed
  filesTotal: integer("files_total").notNull().default(0),
  filesProcessed: integer("files_processed").notNull().default(0),
  txnsInserted: integer("txns_inserted").notNull().default(0),
  txnsSkipped: integer("txns_skipped").notNull().default(0),
  errorMessage: text("error_message"),
  consentVersion: text("consent_version").notNull().default("statement_import_v1"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const importFiles = pgTable("import_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => importBatches.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  format: text("format").notNull(), // qfx | ofx | csv | pdf
  byteSize: integer("byte_size").notNull(),
  contentEncrypted: text("content_encrypted").notNull(),
  status: text("status").notNull().default("stored"), // stored | parsing | preview_ready | parsed | failed | purged
  parsedPreview: jsonb("parsed_preview"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  parsedAt: timestamp("parsed_at", { withTimezone: true }),
});

export const consentRecords = pgTable("consent_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  consentType: text("consent_type").notNull(),
  version: text("version").notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  resourceType: text("resource_type"),
  resourceId: uuid("resource_id"),
  metadata: jsonb("metadata"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
