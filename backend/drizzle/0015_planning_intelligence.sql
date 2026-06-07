ALTER TABLE "budgets" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'user';
ALTER TABLE "budgets" ADD COLUMN IF NOT EXISTS "class" text;

ALTER TABLE "savings_goals" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'custom';
ALTER TABLE "savings_goals" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active';
ALTER TABLE "savings_goals" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'user';
