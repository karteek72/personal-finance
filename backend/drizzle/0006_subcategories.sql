ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sub_category text;
--> statement-breakpoint
ALTER TABLE merchant_category_rules ADD COLUMN IF NOT EXISTS sub_category text;
--> statement-breakpoint
UPDATE transactions SET category = 'Financial & Insurance' WHERE category = 'Financial';
--> statement-breakpoint
UPDATE transactions SET category = 'Transportation' WHERE category = 'Transport & Gas';
--> statement-breakpoint
UPDATE transactions SET category = 'Housing & Home' WHERE category = 'Home & Rent';
--> statement-breakpoint
UPDATE transactions SET category = 'Travel' WHERE category = 'Travel & Hotels';
--> statement-breakpoint
UPDATE merchant_category_rules SET category = 'Financial & Insurance' WHERE category = 'Financial';
--> statement-breakpoint
UPDATE merchant_category_rules SET category = 'Transportation' WHERE category = 'Transport & Gas';
--> statement-breakpoint
UPDATE merchant_category_rules SET category = 'Housing & Home' WHERE category = 'Home & Rent';
--> statement-breakpoint
UPDATE merchant_category_rules SET category = 'Travel' WHERE category = 'Travel & Hotels';
