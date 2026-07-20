CREATE TABLE "metric_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_id" integer NOT NULL,
	"feature_key" text NOT NULL,
	"week_start" text NOT NULL,
	"value" real NOT NULL,
	"tripped" boolean DEFAULT false NOT NULL,
	"trigger_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "metric_observations_unique_idx" ON "metric_observations" USING btree ("metric_id","feature_key","week_start");--> statement-breakpoint
CREATE INDEX "metric_observations_metric_idx" ON "metric_observations" USING btree ("metric_id");