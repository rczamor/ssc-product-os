CREATE TABLE "friday_updates" (
	"id" text PRIMARY KEY DEFAULT 'latest' NOT NULL,
	"body" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "linear_cache" ADD COLUMN "completed_at" timestamp with time zone;