CREATE TABLE IF NOT EXISTS "dim_merchant" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "display_name" text NOT NULL,
  "canonical_key" text NOT NULL,
  CONSTRAINT "dim_merchant_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dim_merchant_user_canonical_idx" ON "dim_merchant" USING btree ("user_id","canonical_key");
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "merchant_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_merchant_id_dim_merchant_id_fk"
    FOREIGN KEY ("merchant_id") REFERENCES "public"."dim_merchant"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tx_user_merchant_date_idx" ON "transactions" USING btree ("user_id","merchant_id","date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_prices" (
  "security_id" uuid NOT NULL,
  "as_of_date" date NOT NULL,
  "close_price" numeric(18, 4) NOT NULL,
  CONSTRAINT "security_prices_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "security_prices_security_id_as_of_date_pk" PRIMARY KEY("security_id","as_of_date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "holdings_snapshots" (
  "user_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "security_id" uuid NOT NULL,
  "as_of_date" date NOT NULL,
  "quantity" numeric(20, 8) NOT NULL,
  "market_value" numeric(14, 2) NOT NULL,
  "cost_basis_total" numeric(14, 2) NOT NULL,
  CONSTRAINT "holdings_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "holdings_snapshots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "holdings_snapshots_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "holdings_snapshots_account_security_date_pk" PRIMARY KEY("account_id","security_id","as_of_date")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "holdings_snapshots_user_date_idx" ON "holdings_snapshots" USING btree ("user_id","as_of_date");
--> statement-breakpoint
CREATE OR REPLACE VIEW mart_portfolio_daily AS
SELECT
  hs.user_id,
  hs.as_of_date,
  SUM(hs.market_value::numeric) AS total_value,
  SUM(hs.cost_basis_total::numeric) AS total_cost
FROM holdings_snapshots hs
GROUP BY hs.user_id, hs.as_of_date;
