CREATE TABLE "linear_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"state_name" text NOT NULL,
	"state_type" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"parent_id" text,
	"url" text,
	"due_date" text,
	"created_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "linear_sync_state" (
	"id" text PRIMARY KEY DEFAULT 'project' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"issue_count" integer DEFAULT 0 NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "ticket_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"draft" jsonb NOT NULL,
	"pushed_issue_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pushed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_drafts_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
ALTER TABLE "ticket_drafts" ADD CONSTRAINT "ticket_drafts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "linear_cache_parent_idx" ON "linear_cache" USING btree ("parent_id");