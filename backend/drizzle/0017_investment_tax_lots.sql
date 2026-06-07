CREATE TABLE IF NOT EXISTS "tax_lots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "security_id" uuid NOT NULL,
  "open_txn_id" uuid,
  "open_date" date NOT NULL,
  "quantity_open" numeric(20, 8) NOT NULL,
  "quantity_remaining" numeric(20, 8) NOT NULL,
  "cost_per_unit" numeric(18, 4) NOT NULL,
  CONSTRAINT "tax_lots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "tax_lots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "tax_lots_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "tax_lots_open_txn_id_investment_transactions_id_fk" FOREIGN KEY ("open_txn_id") REFERENCES "public"."investment_transactions"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tax_lots_user_security_idx" ON "tax_lots" USING btree ("user_id","security_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tax_lots_account_security_idx" ON "tax_lots" USING btree ("account_id","security_id","open_date");
