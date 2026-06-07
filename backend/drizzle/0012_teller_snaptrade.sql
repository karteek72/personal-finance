CREATE TABLE IF NOT EXISTS "teller_enrollments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "teller_enrollment_id" text NOT NULL,
  "access_token_encrypted" text NOT NULL,
  "institution_name" text,
  "status" text DEFAULT 'active' NOT NULL,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "teller_enrollments_teller_enrollment_id_idx"
  ON "teller_enrollments" ("teller_enrollment_id");

CREATE TABLE IF NOT EXISTS "snaptrade_users" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "snaptrade_user_id" text NOT NULL,
  "user_secret_encrypted" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "snaptrade_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "authorization_id" text NOT NULL,
  "brokerage_name" text,
  "status" text DEFAULT 'active' NOT NULL,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "snaptrade_connections_authorization_id_idx"
  ON "snaptrade_connections" ("authorization_id");

ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "teller_enrollment_id" uuid REFERENCES "teller_enrollments"("id") ON DELETE SET NULL;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "teller_account_id" text;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "snaptrade_connection_id" uuid REFERENCES "snaptrade_connections"("id") ON DELETE SET NULL;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "snaptrade_account_id" text;

CREATE UNIQUE INDEX IF NOT EXISTS "accounts_teller_account_id_idx" ON "accounts" ("teller_account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_snaptrade_account_id_idx" ON "accounts" ("snaptrade_account_id");
