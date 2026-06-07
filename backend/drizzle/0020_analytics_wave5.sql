CREATE TABLE IF NOT EXISTS "alert_rules" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "severity" text NOT NULL,
  "basis" text NOT NULL CHECK ("basis" IN ('factual', 'heuristic', 'external')),
  "enabled" boolean NOT NULL DEFAULT true,
  "threshold_json" jsonb NOT NULL DEFAULT '{}'::jsonb
);
--> statement-breakpoint
INSERT INTO "alert_rules" ("id", "name", "description", "severity", "basis", "threshold_json") VALUES
  ('price_creep', 'Subscription price creep', 'Recurring charge increased materially vs 6 months ago', 'warning', 'factual', '{"minCreepPct": 8}'::jsonb),
  ('zombie_subscription', 'Possibly cancelled subscription', 'No charge within 1.5× expected cadence', 'info', 'factual', '{}'::jsonb),
  ('duplicate_subscription', 'Duplicate subscription lane', 'Multiple active subs in the same category lane', 'warning', 'heuristic', '{"confidence": 0.7}'::jsonb),
  ('overdraft_fee', 'Overdraft / NSF fee', 'Overdraft or insufficient-funds fee detected recently', 'warning', 'factual', '{"lookbackDays": 90}'::jsonb),
  ('atm_fee', 'ATM fee', 'Out-of-network ATM fee detected recently', 'info', 'factual', '{"lookbackDays": 90}'::jsonb),
  ('utilization_spike', 'Credit utilization spike', 'Card utilization rose above threshold', 'warning', 'factual', '{"maxUtilization": 0.7}'::jsonb),
  ('ef_breach', 'Emergency fund below target', 'Liquid reserves cover fewer than 3 months essential burn', 'warning', 'factual', '{"minMonths": 3}'::jsonb),
  ('runway_low', 'Runway below 3 months', 'Liquid cash covers fewer than 3 months of essential burn', 'warning', 'factual', '{"minMonths": 3}'::jsonb),
  ('lifestyle_inflation', 'Lifestyle inflation signal', 'Discretionary spend rising faster than income (heuristic)', 'info', 'heuristic', '{"minDeltaPct": 15, "confidence": 0.55}'::jsonb),
  ('bill_cluster_dip', 'Bill-cluster cash dip', 'Large recurring bills cluster in the next 14 days', 'info', 'heuristic', '{"confidence": 0.6}'::jsonb),
  ('wash_sale_risk', 'Wash-sale risk', 'Realized loss repurchased within 30 days (heuristic)', 'info', 'heuristic', '{"confidence": 0.75}'::jsonb),
  ('idle_cash_drag', 'Idle cash drag', 'High uninvested cash share in brokerage accounts', 'info', 'heuristic', '{"minCashShare": 0.15, "confidence": 0.65}'::jsonb),
  ('stale_sync', 'Stale account sync', 'Linked account not synced recently', 'warning', 'factual', '{"maxStaleDays": 7}'::jsonb),
  ('reconciliation_gap', 'Reconciliation gap', 'Transaction sum diverges from balance change', 'warning', 'heuristic', '{"minGapPct": 5, "confidence": 0.5}'::jsonb)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "rule_id" text NOT NULL REFERENCES "alert_rules"("id") ON DELETE CASCADE,
  "severity" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "basis" text NOT NULL CHECK ("basis" IN ('factual', 'heuristic', 'external')),
  "confidence" numeric(4, 3),
  "evidence_json" jsonb,
  "dismissible" boolean NOT NULL DEFAULT true,
  "dismissed" boolean NOT NULL DEFAULT false,
  "triggered_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_alerts_user_rule_idx" ON "user_alerts" ("user_id", "rule_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_alerts_user_active_idx" ON "user_alerts" ("user_id", "dismissed", "triggered_at" DESC);
--> statement-breakpoint
CREATE MATERIALIZED VIEW IF NOT EXISTS "mart_cashflow_month" AS
SELECT
  t.user_id,
  to_char(t.date, 'YYYY-MM') AS month,
  COALESCE(SUM(CASE WHEN t.transaction_type = 'income' AND t.is_transfer = false THEN ABS(t.amount::numeric) ELSE 0 END), 0) AS income,
  COALESCE(SUM(CASE WHEN t.transaction_type = 'expense' AND t.is_transfer = false AND t.category != 'Transfers (internal)' THEN t.amount::numeric ELSE 0 END), 0) AS expense,
  COALESCE(SUM(CASE WHEN t.is_transfer = false AND t.category != 'Transfers (internal)' THEN t.signed_amount::numeric ELSE 0 END), 0) AS net
FROM transactions t
WHERE t.pending = false
GROUP BY t.user_id, to_char(t.date, 'YYYY-MM');
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mart_cashflow_month_user_month_idx"
  ON "mart_cashflow_month" ("user_id", "month");
--> statement-breakpoint
CREATE MATERIALIZED VIEW IF NOT EXISTS "mart_category_month" AS
SELECT
  t.user_id,
  t.category,
  to_char(t.date, 'YYYY-MM') AS month,
  COALESCE(SUM(t.amount::numeric), 0) AS total
FROM transactions t
WHERE t.transaction_type = 'expense'
  AND t.is_transfer = false
  AND t.pending = false
  AND t.category != 'Transfers (internal)'
GROUP BY t.user_id, t.category, to_char(t.date, 'YYYY-MM');
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mart_category_month_user_cat_month_idx"
  ON "mart_category_month" ("user_id", "category", "month");
--> statement-breakpoint
CREATE MATERIALIZED VIEW IF NOT EXISTS "mart_recurring" AS
SELECT
  rs.user_id,
  rs.merchant_name,
  rs.category,
  rs.amount::numeric AS amount,
  rs.cadence,
  rs.status,
  rs.next_charge_date,
  rs.last_charge_date,
  rs.price_changed
FROM recurring_series rs;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mart_recurring_user_merchant_idx"
  ON "mart_recurring" ("user_id", "merchant_name");
--> statement-breakpoint
CREATE MATERIALIZED VIEW IF NOT EXISTS "mart_net_worth_month" AS
SELECT
  bs.account_id,
  a.user_id,
  to_char(bs.as_of_date, 'YYYY-MM') AS month,
  MAX(bs.as_of_date) AS as_of_date,
  COALESCE(SUM(
    CASE
      WHEN a.type IN ('credit', 'loan', 'mortgage') THEN -ABS(COALESCE(bs.balance_current, 0)::numeric)
      ELSE COALESCE(bs.balance_current, 0)::numeric
    END
  ), 0) AS net_worth_component
FROM balance_snapshots bs
INNER JOIN accounts a ON a.id = bs.account_id
WHERE a.is_active = true
GROUP BY bs.account_id, a.user_id, to_char(bs.as_of_date, 'YYYY-MM');
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mart_net_worth_month_acct_month_idx"
  ON "mart_net_worth_month" ("account_id", "month");
