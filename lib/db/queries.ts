import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./index";
import {
  approvals,
  deliverables,
  feedbackItems,
  findings,
  fridayUpdates,
  linearCache,
  linearSyncState,
  metricObservations,
  personaEvaluations,
  reviews,
  runs,
  screenshots,
} from "./schema";
import {
  FEEDBACK_SOURCE_LABELS,
  INGESTION_SOURCES,
  type FeedbackSource,
} from "@/lib/schemas/feedback";
import type { MetricObservation } from "@/lib/schemas/metrics";
import { FridayUpdateSchema, type FridayUpdate } from "@/lib/schemas/friday";
import { isUuid } from "@/lib/validation";

export interface RunWithCounts {
  id: string;
  status: string;
  trigger: string;
  personas: string[];
  langfuseTraceId: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  error: string | null;
  likeCount: number;
  dislikeCount: number;
  hasDeliverable: boolean;
}

/**
 * List recent runs with like/dislike counts and deliverable presence in a
 * fixed 3 queries (list + one grouped count + one deliverable lookup) rather
 * than the N+1 both the dashboard and the runs API previously issued. Shared
 * so the page and the JSON API can never drift.
 */
export async function listRunsWithCounts(limit = 50): Promise<RunWithCounts[]> {
  const db = await getDb();
  const runRows = await db.select().from(runs).orderBy(desc(runs.startedAt)).limit(limit);
  if (runRows.length === 0) return [];
  const ids = runRows.map((r) => r.id);

  const counts = await db
    .select({
      runId: findings.runId,
      likes: sql<number>`count(*) filter (where ${findings.kind} = 'like')`,
      dislikes: sql<number>`count(*) filter (where ${findings.kind} = 'dislike')`,
    })
    .from(findings)
    .where(inArray(findings.runId, ids))
    .groupBy(findings.runId);
  const countByRun = new Map(counts.map((c) => [c.runId, c]));

  const delivered = await db
    .select({ runId: deliverables.runId })
    .from(deliverables)
    .where(inArray(deliverables.runId, ids));
  const hasDeliverable = new Set(delivered.map((d) => d.runId));

  return runRows.map((run) => ({
    ...run,
    likeCount: Number(countByRun.get(run.id)?.likes ?? 0),
    dislikeCount: Number(countByRun.get(run.id)?.dislikes ?? 0),
    hasDeliverable: hasDeliverable.has(run.id),
  }));
}

export interface WorkIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  stateName: string;
  stateType: string;
  priority: number;
  labels: string[];
  parentId: string | null;
  url: string | null;
  dueDate: string | null;
  completedAt: string | null;
}

export interface WorkBoard {
  issues: WorkIssue[];
  lastSyncedAt: Date | null;
  issueCount: number;
}

/** Read the cached Linear board (Work screen). Empty until the first sync. */
export async function getWorkBoard(): Promise<WorkBoard> {
  const db = await getDb();
  const rows = await db.select().from(linearCache);
  const [sync] = await db
    .select()
    .from(linearSyncState)
    .where(eq(linearSyncState.id, "project"));
  return {
    issues: rows.map((r) => ({
      id: r.id,
      identifier: r.identifier,
      title: r.title,
      description: r.description,
      stateName: r.stateName,
      stateType: r.stateType,
      priority: r.priority,
      labels: r.labels ?? [],
      parentId: r.parentId,
      url: r.url,
      dueDate: r.dueDate,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    })),
    lastSyncedAt: sync?.lastSyncedAt ?? null,
    issueCount: sync?.issueCount ?? rows.length,
  };
}

export interface FeedbackRow {
  id: string;
  source: string;
  sourceUrl: string | null;
  reviewDate: string | null;
  rating: number | null;
  title: string | null;
  body: string;
  reviewerRoleRaw: string | null;
  personaGuess: string | null;
  scrapedAt: Date | null;
}

export interface IngestionSource {
  source: string;
  label: string;
  kind: "scraped" | "connector";
  note: string;
  connected: boolean;
  count: number;
  lastUpdated: Date | null;
}

export interface IngestionSummary {
  totalItems: number;
  sources: IngestionSource[];
  personaCounts: Record<string, number>;
  items: FeedbackRow[];
}

/**
 * Ingestion-panel data for the Planning screen: per-source counts + last-updated,
 * merged with the connector catalog so "available but not connected" targets
 * (Pendo/Gong/Gainsight/Snowflake) render as stubs. A source counts as
 * "connected" once it has at least one ingested item. Returns the raw items too
 * so the caller can cluster themes without a second round-trip.
 *
 * Counts (`totalItems`, per-source, `personaCounts`) come from a full-table
 * aggregation, but `items` (used for theme clustering) is bounded to the most
 * recent `itemLimit` rows so a large corpus can't balloon the page payload. At
 * demo scale these coincide; past `itemLimit` the theme "mentions" reflect the
 * recent window while the header counts reflect everything — an intended bound,
 * not drift.
 */
export async function getIngestionSummary(itemLimit = 500): Promise<IngestionSummary> {
  const db = await getDb();

  const grouped = await db
    .select({
      source: feedbackItems.source,
      count: sql<number>`count(*)`,
      lastUpdated: sql<Date | null>`max(${feedbackItems.scrapedAt})`,
      personaGuess: feedbackItems.personaGuess,
    })
    .from(feedbackItems)
    .groupBy(feedbackItems.source, feedbackItems.personaGuess);

  const bySource = new Map<string, { count: number; lastUpdated: Date | null }>();
  const personaCounts: Record<string, number> = {};
  let totalItems = 0;
  for (const g of grouped) {
    const n = Number(g.count);
    totalItems += n;
    const prev = bySource.get(g.source) ?? { count: 0, lastUpdated: null };
    const lu = g.lastUpdated ? new Date(g.lastUpdated) : null;
    bySource.set(g.source, {
      count: prev.count + n,
      lastUpdated:
        lu && (!prev.lastUpdated || lu > prev.lastUpdated) ? lu : prev.lastUpdated,
    });
    const persona = g.personaGuess ?? "unmapped";
    personaCounts[persona] = (personaCounts[persona] ?? 0) + n;
  }

  const sources: IngestionSource[] = INGESTION_SOURCES.map((s) => {
    const stats = bySource.get(s.source);
    const label =
      s.source in FEEDBACK_SOURCE_LABELS
        ? FEEDBACK_SOURCE_LABELS[s.source as FeedbackSource]
        : s.source.charAt(0).toUpperCase() + s.source.slice(1);
    return {
      source: s.source,
      label,
      kind: s.kind,
      note: s.note,
      connected: Boolean(stats && stats.count > 0),
      count: stats?.count ?? 0,
      lastUpdated: stats?.lastUpdated ?? null,
    };
  });

  const items = await db
    .select()
    .from(feedbackItems)
    .orderBy(desc(feedbackItems.scrapedAt))
    .limit(itemLimit);

  return { totalItems, sources, personaCounts, items };
}

/**
 * The hard approval gate. True only when a human `approvals` row exists for the
 * run. Phase 3's matrix→Linear push MUST call this first — no approval, no push.
 */
export async function isRunApproved(runId: string): Promise<boolean> {
  // Fail closed on a malformed id rather than letting Postgres 22P02 reject the
  // caller (e.g. the Phase-3 push) — an unknown run is simply not approved.
  if (!isUuid(runId)) return false;
  const db = await getDb();
  const rows = await db
    .select({ id: approvals.id })
    .from(approvals)
    .where(eq(approvals.runId, runId))
    .limit(1);
  return rows.length > 0;
}

/** All generated metric observations for the Metrics tab (Phase 4). */
export async function getMetricObservations(): Promise<MetricObservation[]> {
  const db = await getDb();
  const rows = await db
    .select({
      metricId: metricObservations.metricId,
      featureKey: metricObservations.featureKey,
      weekStart: metricObservations.weekStart,
      value: metricObservations.value,
      tripped: metricObservations.tripped,
      triggerText: metricObservations.triggerText,
    })
    .from(metricObservations)
    .orderBy(asc(metricObservations.weekStart));
  return rows;
}

/** Full run detail (used by both the run-detail page and the runs/:id API). */
export async function getRunDetail(id: string) {
  const db = await getDb();
  const [run] = await db.select().from(runs).where(eq(runs.id, id));
  if (!run) return null;

  const [personaEvals, findingRows, deliverableRows, shots, reviewRows, approvalRows] =
    await Promise.all([
      db.select().from(personaEvaluations).where(eq(personaEvaluations.runId, id)),
      db.select().from(findings).where(eq(findings.runId, id)).orderBy(asc(findings.createdAt)),
      db.select().from(deliverables).where(eq(deliverables.runId, id)),
      db
        .select({
          id: screenshots.id,
          persona: screenshots.persona,
          label: screenshots.label,
          urlVisited: screenshots.urlVisited,
          width: screenshots.width,
          height: screenshots.height,
          takenAt: screenshots.takenAt,
        })
        .from(screenshots)
        .where(eq(screenshots.runId, id)),
      db.select().from(reviews).where(eq(reviews.runId, id)).orderBy(asc(reviews.createdAt)),
      db.select().from(approvals).where(eq(approvals.runId, id)),
    ]);

  return {
    run,
    personaEvaluations: personaEvals,
    findings: findingRows,
    deliverable: deliverableRows[0] ?? null,
    screenshots: shots,
    reviews: reviewRows,
    approval: approvalRows[0] ?? null,
  };
}

export interface FridayFinding {
  key: string;
  persona: string;
  origin: string;
  kind: string;
  title: string;
  customerPain: string | null;
  severity: number | null;
  specificityScore: number | null;
  actionabilityScore: number | null;
}

export interface FridayReview {
  findingKey: string;
  persona: string;
  reviewerType: string;
  verdict: string;
}

export interface FridayInputs {
  issues: WorkIssue[];
  observations: MetricObservation[];
  /** Total platform-review runs executed to date — the Friday Update's
   *  "workflows run count" for the AI-usage section. */
  runsCount: number;
  /** Findings from the most recent run (mirrors the Planning dashboard's
   *  choice of "current run"), for the customer-impact and accuracy sections. */
  findings: FridayFinding[];
  reviews: FridayReview[];
}

/** Everything buildFridayUpdate needs, gathered in one place (Phase 5). */
export async function getFridayInputs(): Promise<FridayInputs> {
  const db = await getDb();
  const [board, observations, [{ count: runsCountRaw } = { count: 0 }], [latestRun]] =
    await Promise.all([
      getWorkBoard(),
      getMetricObservations(),
      db.select({ count: sql<number>`count(*)` }).from(runs),
      db.select({ id: runs.id }).from(runs).orderBy(desc(runs.startedAt)).limit(1),
    ]);

  let findingRows: FridayFinding[] = [];
  let reviewRows: FridayReview[] = [];
  if (latestRun) {
    [findingRows, reviewRows] = await Promise.all([
      db
        .select({
          key: findings.key,
          persona: findings.persona,
          origin: findings.origin,
          kind: findings.kind,
          title: findings.title,
          customerPain: findings.customerPain,
          severity: findings.severity,
          specificityScore: findings.specificityScore,
          actionabilityScore: findings.actionabilityScore,
        })
        .from(findings)
        .where(eq(findings.runId, latestRun.id)),
      db
        .select({
          findingKey: reviews.findingKey,
          persona: reviews.persona,
          reviewerType: reviews.reviewerType,
          verdict: reviews.verdict,
        })
        .from(reviews)
        .where(eq(reviews.runId, latestRun.id)),
    ]);
  }

  return {
    issues: board.issues,
    observations,
    runsCount: Number(runsCountRaw),
    findings: findingRows,
    reviews: reviewRows,
  };
}

/**
 * The current Friday Update, or null before the first generation. A stored row
 * that no longer satisfies the current schema (e.g. a field's bounds tightened
 * after it was written) degrades to null rather than throwing — the Work page
 * should render "not generated yet", not crash outright over one stale row.
 */
export async function getLatestFridayUpdate(): Promise<FridayUpdate | null> {
  const db = await getDb();
  const [row] = await db.select().from(fridayUpdates).where(eq(fridayUpdates.id, "latest"));
  if (!row) return null;
  const parsed = FridayUpdateSchema.safeParse(row.body);
  if (!parsed.success) {
    console.error("stored friday update failed schema validation:", parsed.error);
    return null;
  }
  return parsed.data;
}

/**
 * Store a freshly generated Friday Update, replacing any prior one wholesale —
 * an atomic upsert (not delete-then-insert) against the single fixed-id row, so
 * two overlapping generations (a double-click, a retried request) can't race:
 * a delete-then-insert leaves a window where one caller's DELETE can run
 * between the other's DELETE and INSERT, throwing a primary-key violation on
 * the losing INSERT or transiently leaving no row for a concurrent GET to read.
 */
export async function saveFridayUpdate(update: FridayUpdate): Promise<void> {
  const db = await getDb();
  await db
    .insert(fridayUpdates)
    .values({ id: "latest", body: update, generatedAt: new Date(update.generatedAt) })
    .onConflictDoUpdate({
      target: fridayUpdates.id,
      set: { body: update, generatedAt: new Date(update.generatedAt) },
    });
}
