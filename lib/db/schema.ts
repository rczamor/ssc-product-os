import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  customType,
} from "drizzle-orm/pg-core";

/** Postgres bytea, surfaced as a Node Buffer. */
export const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** running | completed | failed */
  status: text("status").notNull().default("running"),
  /** ui | slash | routine */
  trigger: text("trigger").notNull().default("slash"),
  personas: jsonb("personas").$type<string[]>().notNull().default(["ciso", "vrm", "gtm_cs"]),
  langfuseTraceId: text("langfuse_trace_id"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  error: text("error"),
});

export const runRequests = pgTable(
  "run_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** queued | claimed | running | completed | failed | cancelled */
    status: text("status").notNull().default("queued"),
    personas: jsonb("personas").$type<string[]>().notNull().default(["ciso", "vrm", "gtm_cs"]),
    note: text("note"),
    requestedBy: text("requested_by").notNull().default("admin-ui"),
    runId: uuid("run_id").references(() => runs.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
  },
  (t) => [index("run_requests_status_idx").on(t.status, t.createdAt)],
);

export const personaEvaluations = pgTable(
  "persona_evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    /** ciso | vrm | gtm_cs */
    persona: text("persona").notNull(),
    /** running | completed | failed */
    status: text("status").notNull().default("running"),
    summary: text("summary"),
    /** [{label, url, note?, screenshotId?}] */
    journey: jsonb("journey").$type<unknown[]>(),
    /** Full validated PersonaOutput as produced by the agent. */
    rawOutput: jsonb("raw_output"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("persona_evaluations_run_persona_idx").on(t.runId, t.persona)],
);

export const findings = pgTable(
  "findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    persona: text("persona").notNull(),
    /** Agent-chosen slug, stable within (run, persona); judge scores join on it. */
    key: text("key").notNull(),
    /** like | dislike */
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    /** Dislikes only. */
    customerPain: text("customer_pain"),
    /** JTBD/KPI supported (likes) or blocked (dislikes). */
    jtbd: text("jtbd"),
    /** ux | data | workflow | packaging | strategy (dislikes only). */
    rootCause: text("root_cause"),
    /** S | M | L (dislikes only). */
    effort: text("effort"),
    firstAction: text("first_action"),
    severity: integer("severity"),
    screenshotIds: jsonb("screenshot_ids").$type<string[]>().notNull().default([]),
    /** Full finding object as validated. */
    raw: jsonb("raw").notNull(),
    specificityScore: real("specificity_score"),
    actionabilityScore: real("actionability_score"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("findings_run_idx").on(t.runId),
    uniqueIndex("findings_run_persona_key_idx").on(t.runId, t.persona, t.key),
  ],
);

export const deliverables = pgTable("deliverables", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .unique()
    .references(() => runs.id, { onDelete: "cascade" }),
  /** Exactly 3 items (DeliverableLike[]). */
  likes: jsonb("likes").notNull(),
  /** Exactly 5 items (DeliverableDislike[]). */
  dislikes: jsonb("dislikes").notNull(),
  /** KfdRow[] — the Kill / Fix / Double-Down table. */
  kfdTable: jsonb("kfd_table").notNull(),
  /** Rendered Prompt-1 deliverable, ready to paste into the submission. */
  markdown: text("markdown").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const screenshots = pgTable(
  "screenshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    persona: text("persona"),
    label: text("label").notNull(),
    urlVisited: text("url_visited"),
    contentType: text("content_type").notNull().default("image/jpeg"),
    /** Primary storage. JPEG q60 viewport shots ≈ 80-200 KB each. */
    data: bytea("data"),
    /** Reserved upgrade path to Vercel Blob; unused today. */
    blobUrl: text("blob_url"),
    width: integer("width"),
    height: integer("height"),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("screenshots_run_idx").on(t.runId),
    uniqueIndex("screenshots_run_persona_label_idx").on(t.runId, t.persona, t.label),
  ],
);
