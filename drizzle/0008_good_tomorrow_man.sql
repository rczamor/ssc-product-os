ALTER TABLE "findings" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "archived_reason" text;