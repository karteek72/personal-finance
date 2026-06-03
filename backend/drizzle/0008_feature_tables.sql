CREATE TABLE IF NOT EXISTS "securities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticker" text NOT NULL,
	"name" text NOT NULL,
	"asset_type" text NOT NULL,
	"sector" text,
	"current_price" numeric(18, 4) NOT NULL,
	"currency_code" text DEFAULT 'USD' NOT NULL,
	"as_of" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "securities_ticker_unique" UNIQUE("ticker")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
	"security_id" uuid NOT NULL REFERENCES "securities"("id") ON DELETE cascade,
	"quantity" numeric(20, 8) NOT NULL,
	"cost_basis" numeric(18, 4) NOT NULL,
	"institution_value" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "holdings_account_security_idx" ON "holdings" USING btree ("account_id","security_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "investment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
	"security_id" uuid REFERENCES "securities"("id") ON DELETE set null,
	"external_id" text NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric(20, 8),
	"price" numeric(18, 4),
	"amount" numeric(14, 2) NOT NULL,
	"fees" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "investment_txn_account_external_id_idx" ON "investment_transactions" USING btree ("account_id","external_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "net_worth_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"month" text NOT NULL,
	"total_assets" numeric(14, 2) NOT NULL,
	"total_liabilities" numeric(14, 2) NOT NULL,
	"net_worth" numeric(14, 2) NOT NULL,
	"breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "net_worth_user_month_idx" ON "net_worth_snapshots" USING btree ("user_id","month");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"category" text NOT NULL,
	"period_month" text NOT NULL,
	"limit_amount" numeric(12, 2) NOT NULL,
	"emoji" text,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "budgets_user_category_period_idx" ON "budgets" USING btree ("user_id","category","period_month");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "savings_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"target_amount" numeric(12, 2) NOT NULL,
	"current_amount" numeric(12, 2) NOT NULL,
	"deadline" date,
	"emoji" text,
	"color" text,
	"account_id" uuid REFERENCES "accounts"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recurring_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"merchant_name" text NOT NULL,
	"category" text NOT NULL,
	"kind" text DEFAULT 'subscription' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"cadence" text DEFAULT 'monthly' NOT NULL,
	"next_charge_date" date,
	"last_charge_date" date,
	"previous_amount" numeric(12, 2),
	"price_changed" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"brand_color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fire_profiles" (
	"user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE cascade,
	"current_age" integer NOT NULL,
	"current_net_worth" numeric(14, 2) NOT NULL,
	"monthly_spend" numeric(12, 2) NOT NULL,
	"monthly_invest" numeric(12, 2) NOT NULL,
	"withdrawal_rate" numeric(5, 2) NOT NULL,
	"real_return" numeric(5, 2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wellness_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"period_month" text NOT NULL,
	"score" integer NOT NULL,
	"dimensions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wellness_user_period_idx" ON "wellness_scores" USING btree ("user_id","period_month");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spending_dna" (
	"user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE cascade,
	"archetype" text NOT NULL,
	"narrative" text NOT NULL,
	"peer_rarity" text,
	"axes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spending_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"metric" text,
	"description" text,
	"severity" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transaction_reasons" (
	"transaction_id" uuid PRIMARY KEY REFERENCES "transactions"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"reason_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"title" text NOT NULL,
	"goal" text NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"days_remaining" integer DEFAULT 0 NOT NULL,
	"complete" boolean DEFAULT false NOT NULL,
	"color" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "habit_streaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"label" text NOT NULL,
	"current_days" integer DEFAULT 0 NOT NULL,
	"max_days" integer DEFAULT 0 NOT NULL,
	"color" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lifestyle_habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"category" text NOT NULL,
	"emoji" text,
	"label" text NOT NULL,
	"monthly_amount" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inflation_profiles" (
	"user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE cascade,
	"personal_rate" numeric(5, 2) NOT NULL,
	"national_cpi" numeric(5, 2) NOT NULL,
	"salary" numeric(14, 2) NOT NULL,
	"raise_percent" numeric(5, 2) NOT NULL,
	"nominal_savings_rate" numeric(5, 2) NOT NULL,
	"power_loss" numeric(14, 2),
	"base_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inflation_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"share" numeric(5, 2) NOT NULL,
	"inflation_rate" numeric(5, 2) NOT NULL,
	"severity" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resilience_profiles" (
	"user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE cascade,
	"liquid_cash" numeric(14, 2) NOT NULL,
	"monthly_burn" numeric(12, 2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resilience_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"emoji" text,
	"shock_amount" numeric(12, 2) NOT NULL,
	"shock_type" text DEFAULT 'recurring' NOT NULL,
	"recommended_months" numeric(5, 1) NOT NULL,
	"detail" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coach_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"kind" text NOT NULL,
	"period_month" text,
	"question" text,
	"answer" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wrapped_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"year" integer NOT NULL,
	"total_spent" numeric(14, 2) NOT NULL,
	"transaction_count" integer NOT NULL,
	"total_saved" numeric(14, 2) NOT NULL,
	"savings_rate" numeric(5, 2) NOT NULL,
	"peer_percentile" text,
	"archetype" text,
	"top_category" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"personality" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"moments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wrapped_user_year_idx" ON "wrapped_summaries" USING btree ("user_id","year");
