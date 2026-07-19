import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./index";
import {
  deliverables,
  findings,
  personaEvaluations,
  runs,
  screenshots,
} from "./schema";

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

/** Full run detail (used by both the run-detail page and the runs/:id API). */
export async function getRunDetail(id: string) {
  const db = await getDb();
  const [run] = await db.select().from(runs).where(eq(runs.id, id));
  if (!run) return null;

  const [personaEvals, findingRows, deliverableRows, shots] = await Promise.all([
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
  ]);

  return {
    run,
    personaEvaluations: personaEvals,
    findings: findingRows,
    deliverable: deliverableRows[0] ?? null,
    screenshots: shots,
  };
}
