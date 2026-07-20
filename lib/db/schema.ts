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
    /** agent | human — who authored this finding (agent runs vs. reviewer adds). */
    origin: text("origin").notNull().default("agent"),
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

/**
 * Ingested customer feedback (Phase 1). Scraped review-site items plus a place
 * for future connectors (Pendo/Gong/Gainsight/Snowflake). `dedupeKey` is the
 * idempotency key (source_url when present, else a stable hash) so re-running
 * the scraper skips what already exists.
 */
export const feedbackItems = pgTable(
  "feedback_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** capterra | g2 | trustradius | pendo | gong | gainsight */
    source: text("source").notNull(),
    sourceUrl: text("source_url"),
    /** Stable dedupe key: source_url or a hash of source+title+body. */
    dedupeKey: text("dedupe_key").notNull(),
    /** Review date as reported by the source (free-form string, e.g. "May 2026"). */
    reviewDate: text("review_date"),
    rating: real("rating"),
    title: text("title"),
    body: text("body").notNull(),
    reviewerRoleRaw: text("reviewer_role_raw"),
    /** Inferred from reviewer role: ciso | vrm | gtm_cs | null. */
    personaGuess: text("persona_guess"),
    scrapedAt: timestamp("scraped_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("feedback_items_source_idx").on(t.source),
    uniqueIndex("feedback_items_dedupe_idx").on(t.dedupeKey),
  ],
);

/**
 * Human/agent reviews of individual findings (Phase 2). A review is an up/down
 * verdict + optional comment on a finding, attributed to a reviewer. Human votes
 * upsert on the unique key so a reviewer can change their mind; the judge's
 * scores are surfaced as the agent review of each finding (from the findings
 * columns), so this table is primarily the human layer.
 */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    /** The finding this review targets (findings.key, stable within run+persona). */
    findingKey: text("finding_key").notNull(),
    persona: text("persona").notNull(),
    /** human | agent */
    reviewerType: text("reviewer_type").notNull(),
    reviewerName: text("reviewer_name").notNull().default("admin"),
    /** up | down */
    verdict: text("verdict").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reviews_run_idx").on(t.runId),
    // One vote per (finding, reviewer): re-voting upserts rather than piling up.
    uniqueIndex("reviews_unique_idx").on(
      t.runId,
      t.findingKey,
      t.persona,
      t.reviewerType,
      t.reviewerName,
    ),
  ],
);

/**
 * The human approval gate (Phase 2). A row here means a human has approved the
 * run's matrix; it is the SOLE trigger for the Phase-3 matrix→Linear push.
 * One approval per run (unique run_id) — approving is idempotent.
 */
export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .unique()
    .references(() => runs.id, { onDelete: "cascade" }),
  approvedBy: text("approved_by").notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The drafted matrix→Linear tickets for a run (Phase 3). One draft per run
 * (unique run_id). `draft` is the validated TicketDraft; `pushedIssueIds` records
 * every Linear issue created so a re-push is a no-op (idempotent). `pushedAt` is
 * null until an approved push succeeds.
 */
export const ticketDrafts = pgTable("ticket_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .unique()
    .references(() => runs.id, { onDelete: "cascade" }),
  /** Validated TicketDraft (epics + CCB decisions). */
  draft: jsonb("draft").notNull(),
  /** [{ key, issueId, identifier, url, subIssueIds }] once pushed. */
  pushedIssueIds: jsonb("pushed_issue_ids").$type<unknown[]>().notNull().default([]),
  pushedAt: timestamp("pushed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Server-side cache of the SSC-ProductOS project's Linear issues (Phase 3), so
 * the Work screen renders without a live API round-trip on every request. Keyed
 * by the Linear issue id; upserted on each sync.
 */
export const linearCache = pgTable(
  "linear_cache",
  {
    /** Linear issue id (uuid string). */
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    /** Workflow state name (Todo/In Progress/In Review/Done/…). */
    stateName: text("state_name").notNull(),
    stateType: text("state_type").notNull(),
    priority: integer("priority").notNull().default(0),
    labels: jsonb("labels").$type<string[]>().notNull().default([]),
    parentId: text("parent_id"),
    url: text("url"),
    dueDate: text("due_date"),
    createdAt: timestamp("created_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("linear_cache_parent_idx").on(t.parentId)],
);

/** Single-row sync metadata for the Work screen's "last synced" stamp. */
export const linearSyncState = pgTable("linear_sync_state", {
  id: text("id").primaryKey().default("project"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  issueCount: integer("issue_count").notNull().default(0),
  note: text("note"),
});
