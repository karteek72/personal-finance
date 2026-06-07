CREATE TABLE IF NOT EXISTS "transfer_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "outflow_txn_id" uuid,
  "inflow_txn_id" uuid,
  "inflow_investment_txn_id" uuid,
  "match_confidence" numeric(4, 3) NOT NULL,
  "link_kind" text NOT NULL,
  CONSTRAINT "transfer_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "transfer_links_outflow_txn_id_transactions_id_fk" FOREIGN KEY ("outflow_txn_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "transfer_links_inflow_txn_id_transactions_id_fk" FOREIGN KEY ("inflow_txn_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "transfer_links_inflow_investment_txn_id_investment_transactions_id_fk" FOREIGN KEY ("inflow_investment_txn_id") REFERENCES "public"."investment_transactions"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "transfer_links_link_kind_check" CHECK ("link_kind" IN ('bank_bank', 'bank_brokerage', 'cc_payment'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfer_links_user_idx" ON "transfer_links" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transfer_links_outflow_unique_idx" ON "transfer_links" USING btree ("outflow_txn_id") WHERE "outflow_txn_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transfer_links_inflow_unique_idx" ON "transfer_links" USING btree ("inflow_txn_id") WHERE "inflow_txn_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transfer_links_inflow_invest_unique_idx" ON "transfer_links" USING btree ("inflow_investment_txn_id") WHERE "inflow_investment_txn_id" IS NOT NULL;
