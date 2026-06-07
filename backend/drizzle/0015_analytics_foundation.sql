ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "signed_amount" numeric(14, 2) GENERATED ALWAYS AS (
  CASE
    WHEN transaction_type = 'expense' THEN -abs(amount)
    WHEN transaction_type = 'income' THEN abs(amount)
    ELSE 0
  END
) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tx_user_date_idx" ON "transactions" USING btree ("user_id","date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tx_user_cat_date_idx" ON "transactions" USING btree ("user_id","category","date");
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "credit_limit" numeric(12, 2);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "balance_snapshots" (
  "account_id" uuid NOT NULL,
  "as_of_date" date NOT NULL,
  "balance_current" numeric(14, 2),
  "balance_available" numeric(14, 2),
  "credit_limit" numeric(14, 2),
  CONSTRAINT "balance_snapshots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "balance_snapshots_account_id_as_of_date_pk" PRIMARY KEY("account_id","as_of_date")
);
