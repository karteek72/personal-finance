CREATE TABLE IF NOT EXISTS "consent_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "consent_type" text NOT NULL,
  "version" text NOT NULL,
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consent_records_user_type_idx"
  ON "consent_records" ("user_id", "consent_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "action" text NOT NULL,
  "resource_type" text,
  "resource_id" uuid,
  "metadata" jsonb,
  "ip_address" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_user_created_idx"
  ON "audit_events" ("user_id", "created_at");
