CREATE TABLE "feedback_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_url" text,
	"dedupe_key" text NOT NULL,
	"review_date" text,
	"rating" real,
	"title" text,
	"body" text NOT NULL,
	"reviewer_role_raw" text,
	"persona_guess" text,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "feedback_items_source_idx" ON "feedback_items" USING btree ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_items_dedupe_idx" ON "feedback_items" USING btree ("dedupe_key");