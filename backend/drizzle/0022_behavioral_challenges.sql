ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "dismissed" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "fire_profiles" ADD COLUMN IF NOT EXISTS "real_return_user_set" boolean NOT NULL DEFAULT false;
