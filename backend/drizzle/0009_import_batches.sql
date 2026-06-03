CREATE TABLE IF NOT EXISTS "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"status" text DEFAULT 'pending' NOT NULL,
	"files_total" integer DEFAULT 0 NOT NULL,
	"files_processed" integer DEFAULT 0 NOT NULL,
	"txns_inserted" integer DEFAULT 0 NOT NULL,
	"txns_skipped" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"consent_version" text DEFAULT 'statement_import_v1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "import_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL REFERENCES "import_batches"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"filename" text NOT NULL,
	"format" text NOT NULL,
	"byte_size" integer NOT NULL,
	"content_encrypted" text NOT NULL,
	"status" text DEFAULT 'stored' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"parsed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "import_batches_user_status_idx" ON "import_batches" USING btree ("user_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "import_files_batch_id_idx" ON "import_files" USING btree ("batch_id");
