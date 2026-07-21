import { and, eq, isNull, sql } from "drizzle-orm";
import type { Issue } from "@linear/sdk";
import type { Db } from "@/lib/db";
import { linearCache, linearSyncState, ticketDrafts } from "@/lib/db/schema";
import {
  getLinearClient,
  getLinearConfig,
  isLinearConfigured,
  labelId,
  stateId,
} from "@/lib/linear";
import { TicketDraftSchema, type Ticket } from "@/lib/schemas/ticket";

export class LinearNotConfiguredError extends Error {
  constructor() {
    super("LINEAR_API_KEY is not set — Linear reads/writes are unavailable");
    this.name = "LinearNotConfiguredError";
  }
}

/**
 * Map a Linear issue to a linear_cache row, resolving its state, labels, and
 * parent. Shared by the full project sync (syncProjectToCache) and the
 * per-issue webhook upsert (upsertIssueToCache) so the two can't drift.
 */
async function issueToCacheRow(issue: Issue) {
  const [state, labelConn, parent] = await Promise.all([
    issue.state,
    issue.labels(),
    issue.parent,
  ]);
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description ?? null,
    stateName: state?.name ?? "Unknown",
    stateType: state?.type ?? "unstarted",
    priority: issue.priority ?? 0,
    labels: labelConn.nodes.map((l) => l.name),
    parentId: parent?.id ?? null,
    url: issue.url ?? null,
    dueDate: issue.dueDate ?? null,
    createdAt: issue.createdAt ?? null,
    completedAt: issue.completedAt ?? null,
    syncedAt: new Date(),
  };
}
type CacheRow = Awaited<ReturnType<typeof issueToCacheRow>>;

/** The mutable columns of a cache row (everything but the primary-key id) — the
 *  `set` for an upsert. */
function cacheRowUpdate(row: CacheRow) {
  return {
    identifier: row.identifier,
    title: row.title,
    description: row.description,
    stateName: row.stateName,
    stateType: row.stateType,
    priority: row.priority,
    labels: row.labels,
    parentId: row.parentId,
    url: row.url,
    dueDate: row.dueDate,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    syncedAt: row.syncedAt,
  };
}

/** Stamp the sync state's last-synced time + current cache size. Used by the
 *  per-issue webhook path so the Work screen's "synced" stamp stays fresh
 *  between full syncs. */
async function bumpSyncState(db: Db): Promise<void> {
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(linearCache);
  const n = Number(count);
  const now = new Date();
  // Clear any stale "N issue(s) failed to sync" note from a prior full sync — a
  // successful per-issue write means the cache is current, so the warning
  // shouldn't linger next to a fresh "synced just now" stamp.
  await db
    .insert(linearSyncState)
    .values({ id: "project", lastSyncedAt: now, issueCount: n, note: null })
    .onConflictDoUpdate({
      target: linearSyncState.id,
      set: { lastSyncedAt: now, issueCount: n, note: null },
    });
}

/**
 * Upsert a single Linear issue into linear_cache from a webhook event — the
 * inbound half of the two-way sync. Fetches the issue fresh (so state/label
 * names and parent are complete) and IGNORES issues outside the SSC-ProductOS
 * project. Returns true when a row was written, false when the issue is gone or
 * belongs to another project. Throws LinearNotConfiguredError without a key.
 */
export async function upsertIssueToCache(db: Db, issueId: string): Promise<boolean> {
  if (!isLinearConfigured()) throw new LinearNotConfiguredError();
  const cfg = getLinearConfig();
  const issue = await getLinearClient().issue(issueId);
  if (!issue) return false;
  const project = await issue.project;
  if (project?.id !== cfg.project.id) {
    // Not (or no longer) in our project — if it was cached from when it was,
    // drop the now-stale row rather than leaving a ghost on the Work board.
    await removeIssueFromCache(db, issueId);
    return false;
  }
  const row = await issueToCacheRow(issue);
  await db
    .insert(linearCache)
    .values(row)
    .onConflictDoUpdate({ target: linearCache.id, set: cacheRowUpdate(row) });
  await bumpSyncState(db);
  return true;
}

/** Remove a single issue from linear_cache (a webhook `remove` event). Deleting
 *  a row that isn't cached is a harmless no-op. */
export async function removeIssueFromCache(db: Db, issueId: string): Promise<void> {
  await db.delete(linearCache).where(eq(linearCache.id, issueId));
  await bumpSyncState(db);
}

/**
 * Pull every issue in the SSC-ProductOS project into linear_cache and stamp the
 * sync time. Delete-then-insert so the cache exactly mirrors the board. Throws
 * LinearNotConfiguredError when no key is set (the caller returns 503).
 *
 * Paginates through the FULL issue list (Linear caps a single page at 250) —
 * a delete-then-insert sync that only fetched page one would actively DELETE
 * previously-cached issues past #250 on every subsequent sync, not just leave
 * them stale. A single issue's detail fetch failing (rate limit, transient
 * error) is skipped rather than aborting the whole sync, so one bad issue can't
 * block caching the rest.
 */
export async function syncProjectToCache(db: Db): Promise<{ count: number; skipped: number }> {
  if (!isLinearConfigured()) throw new LinearNotConfiguredError();
  const cfg = getLinearConfig();
  const client = getLinearClient();
  const project = await client.project(cfg.project.id);

  const nodes: Awaited<ReturnType<typeof project.issues>>["nodes"] = [];
  let after: string | undefined;
  for (;;) {
    const connection = await project.issues({ first: 250, after });
    nodes.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) break;
    after = connection.pageInfo.endCursor ?? undefined;
    if (!after) break;
  }

  const settled = await Promise.allSettled(nodes.map(issueToCacheRow));
  const rows = settled
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<CacheRow>).value);
  const skipped = settled.length - rows.length;

  await db.delete(linearCache);
  if (rows.length > 0) await db.insert(linearCache).values(rows);
  await db
    .insert(linearSyncState)
    .values({
      id: "project",
      lastSyncedAt: new Date(),
      issueCount: rows.length,
      note: skipped > 0 ? `${skipped} issue(s) failed to sync and were skipped` : null,
    })
    .onConflictDoUpdate({
      target: linearSyncState.id,
      set: {
        lastSyncedAt: new Date(),
        issueCount: rows.length,
        note: skipped > 0 ? `${skipped} issue(s) failed to sync and were skipped` : null,
      },
    });

  return { count: rows.length, skipped };
}

function priorityToLinear(p: number): number {
  // Our schema uses 1..4 (urgent..low) which already matches Linear's priority ints.
  return p >= 1 && p <= 4 ? p : 0;
}

async function createOneIssue(
  client: ReturnType<typeof getLinearClient>,
  input: {
    title: string;
    description: string;
    priority: number;
    labelNames: string[];
    parentId?: string;
    stateName?: string;
  },
): Promise<{ id: string; identifier: string; url: string }> {
  const cfg = getLinearConfig();
  const labelIds = input.labelNames.map((n) => labelId(n));
  const payload = await client.createIssue({
    teamId: cfg.team.id,
    projectId: cfg.project.id,
    title: input.title,
    description: input.description,
    priority: priorityToLinear(input.priority),
    labelIds,
    parentId: input.parentId,
    stateId: input.stateName ? stateId(input.stateName) : undefined,
  });
  const issue = await payload.issue;
  if (!issue) throw new Error(`Linear createIssue returned no issue for "${input.title}"`);
  return { id: issue.id, identifier: issue.identifier, url: issue.url };
}

export interface PushedTicket {
  key: string;
  issueId: string;
  identifier: string;
  url: string;
  subIssueIds: string[];
}

/**
 * Create the drafted tickets in Linear. The CALLER must have already checked
 * isRunApproved — this function creates issues unconditionally, so it must never
 * be reached for an unapproved run.
 *
 * Idempotent AND race-safe: a Linear createIssue call is a real, non-repeatable
 * side effect (unlike drafting, which is pure), so a plain read-then-write on
 * `pushedAt` would let two concurrent pushes (a double-click, a retried request)
 * both see "not pushed yet" and both create duplicate issues. Instead we CLAIM
 * the push with a single atomic `UPDATE … WHERE pushed_at IS NULL`: only one
 * concurrent caller can win that update (Postgres guarantees single-statement
 * atomicity even without an explicit transaction), so only one caller ever
 * proceeds to create issues. A caller that loses the race returns whatever the
 * winner (or an already-completed prior push) recorded.
 */
export async function pushDraftToLinear(db: Db, runId: string): Promise<PushedTicket[]> {
  if (!isLinearConfigured()) throw new LinearNotConfiguredError();

  const claimed = await db
    .update(ticketDrafts)
    .set({ pushedAt: new Date() })
    .where(and(eq(ticketDrafts.runId, runId), isNull(ticketDrafts.pushedAt)))
    .returning();

  if (claimed.length === 0) {
    // Either no draft exists, or another caller already claimed/finished the push.
    const [existing] = await db.select().from(ticketDrafts).where(eq(ticketDrafts.runId, runId));
    if (!existing) throw new Error("no ticket draft for this run — draft it first");
    return existing.pushedIssueIds as PushedTicket[];
  }

  const row = claimed[0];
  const draft = TicketDraftSchema.parse(row.draft);
  const client = getLinearClient();

  // Resume-safe: a prior attempt may have failed partway (network blip, function
  // timeout) after claiming but before finishing. Skip any ticket key already
  // recorded so a retry never re-creates an issue that already exists in Linear
  // — the spec requires "re-click creates nothing new" even across a failure.
  const already = (row.pushedIssueIds as PushedTicket[]) ?? [];
  const alreadyKeys = new Set(already.map((p) => p.key));
  const pushed: PushedTicket[] = [...already];

  try {
    for (const ticket of draft.tickets as Ticket[]) {
      if (alreadyKeys.has(ticket.key)) continue;
      const parent = await createOneIssue(client, {
        title: ticket.title,
        description: ticket.description,
        priority: ticket.priority,
        labelNames: ticket.labels,
      });
      const subIssueIds: string[] = [];
      if (ticket.type === "epic") {
        for (const sub of ticket.subIssues) {
          const child = await createOneIssue(client, {
            title: sub.title,
            description: sub.description,
            priority: ticket.priority,
            labelNames: ticket.labels,
            parentId: parent.id,
          });
          subIssueIds.push(child.id);
        }
      }
      pushed.push({
        key: ticket.key,
        issueId: parent.id,
        identifier: parent.identifier,
        url: parent.url,
        subIssueIds,
      });
      // Persist after each ticket so a later failure (or a serverless timeout
      // that kills the function before the catch below runs) doesn't lose
      // already-created issues off the resume list.
      await db.update(ticketDrafts).set({ pushedIssueIds: pushed }).where(eq(ticketDrafts.runId, runId));
    }
  } catch (e) {
    // Release the claim so the run isn't stuck "pushed" with nothing to show
    // for it; the resume-safe skip above means a retry only creates what's left.
    await db.update(ticketDrafts).set({ pushedAt: null }).where(eq(ticketDrafts.runId, runId));
    throw e;
  }

  await db
    .update(ticketDrafts)
    .set({ pushedIssueIds: pushed, pushedAt: new Date() })
    .where(eq(ticketDrafts.runId, runId));

  return pushed;
}
