import { and, eq, isNull } from "drizzle-orm";
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

  async function toCacheRow(issue: (typeof nodes)[number]) {
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

  const settled = await Promise.allSettled(nodes.map(toCacheRow));
  const rows = settled
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof toCacheRow>>>).value);
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
