CREATE TABLE IF NOT EXISTS "dim_category" (
  "category" text PRIMARY KEY,
  "spend_class" text NOT NULL,
  "is_essential" boolean NOT NULL DEFAULT false,
  "cpi_weight_eligible" boolean NOT NULL DEFAULT false,
  CONSTRAINT "dim_category_spend_class_check" CHECK (
    "spend_class" IN ('fixed', 'variable', 'discretionary', 'income', 'transfer')
  )
);
--> statement-breakpoint
INSERT INTO "dim_category" ("category", "spend_class", "is_essential", "cpi_weight_eligible") VALUES
  ('Food & Groceries', 'variable', true, true),
  ('Dining & Restaurants', 'discretionary', false, false),
  ('Housing & Home', 'fixed', true, true),
  ('Utilities & Bills', 'fixed', true, true),
  ('Transportation', 'variable', true, true),
  ('Subscriptions & Software', 'fixed', false, true),
  ('Financial & Insurance', 'fixed', true, true),
  ('Health & Medical', 'variable', true, true),
  ('Education', 'variable', true, false),
  ('Shopping & Retail', 'discretionary', false, false),
  ('Entertainment', 'discretionary', false, false),
  ('Personal Care', 'variable', true, false),
  ('Family & Kids', 'variable', true, false),
  ('Pet', 'variable', false, false),
  ('Gifts & Donations', 'discretionary', false, false),
  ('Business & Professional', 'variable', false, false),
  ('Travel', 'discretionary', false, false),
  ('Income', 'income', false, false),
  ('Transfers (internal)', 'transfer', false, false),
  ('Uncategorized', 'variable', false, false)
ON CONFLICT ("category") DO NOTHING;
