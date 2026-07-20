ALTER TABLE "findings" ADD COLUMN "verdict" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "retries_caught" integer DEFAULT 0 NOT NULL;