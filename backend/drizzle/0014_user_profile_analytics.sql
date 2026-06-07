ALTER TABLE "fire_profiles" ADD COLUMN IF NOT EXISTS "household_size" integer;
ALTER TABLE "fire_profiles" ADD COLUMN IF NOT EXISTS "annual_gross_income" numeric(14, 2);
ALTER TABLE "fire_profiles" ADD COLUMN IF NOT EXISTS "target_retirement_age" integer;
ALTER TABLE "fire_profiles" ADD COLUMN IF NOT EXISTS "employment_status" text;
ALTER TABLE "fire_profiles" ADD COLUMN IF NOT EXISTS "risk_tolerance" text;
