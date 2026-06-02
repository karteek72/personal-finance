ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_sub" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_sub_idx" ON "users" ("google_sub") WHERE "google_sub" IS NOT NULL;
