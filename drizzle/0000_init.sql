CREATE TABLE "deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"likes" jsonb NOT NULL,
	"dislikes" jsonb NOT NULL,
	"kfd_table" jsonb NOT NULL,
	"markdown" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliverables_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"persona" text NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"customer_pain" text,
	"jtbd" text,
	"root_cause" text,
	"effort" text,
	"first_action" text,
	"severity" integer,
	"screenshot_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"raw" jsonb NOT NULL,
	"specificity_score" real,
	"actionability_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"persona" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"summary" text,
	"journey" jsonb,
	"raw_output" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "run_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"personas" jsonb DEFAULT '["ciso","vrm","gtm_cs"]'::jsonb NOT NULL,
	"note" text,
	"requested_by" text DEFAULT 'admin-ui' NOT NULL,
	"run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"trigger" text DEFAULT 'slash' NOT NULL,
	"personas" jsonb DEFAULT '["ciso","vrm","gtm_cs"]'::jsonb NOT NULL,
	"langfuse_trace_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "screenshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"persona" text,
	"label" text NOT NULL,
	"url_visited" text,
	"content_type" text DEFAULT 'image/jpeg' NOT NULL,
	"data" "bytea",
	"blob_url" text,
	"width" integer,
	"height" integer,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_evaluations" ADD CONSTRAINT "persona_evaluations_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_requests" ADD CONSTRAINT "run_requests_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "findings_run_idx" ON "findings" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "findings_run_persona_key_idx" ON "findings" USING btree ("run_id","persona","key");--> statement-breakpoint
CREATE UNIQUE INDEX "persona_evaluations_run_persona_idx" ON "persona_evaluations" USING btree ("run_id","persona");--> statement-breakpoint
CREATE INDEX "run_requests_status_idx" ON "run_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "screenshots_run_idx" ON "screenshots" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "screenshots_run_persona_label_idx" ON "screenshots" USING btree ("run_id","persona","label");