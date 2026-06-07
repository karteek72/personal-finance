ALTER TABLE "import_files" ADD COLUMN IF NOT EXISTS "parsed_preview" jsonb;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "dedup_fingerprint" text;
--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD COLUMN IF NOT EXISTS "dedup_fingerprint" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_account_dedup_fp_idx"
  ON "transactions" ("account_id", "dedup_fingerprint")
  WHERE "dedup_fingerprint" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "investment_txn_account_dedup_fp_idx"
  ON "investment_transactions" ("account_id", "dedup_fingerprint")
  WHERE "dedup_fingerprint" IS NOT NULL;
