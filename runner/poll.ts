/**
 * Claims the oldest queued run request (atomically — safe under concurrent
 * pollers via FOR UPDATE SKIP LOCKED). The Claude Code Routine calls this
 * hourly; a claimed request is then executed with the platform-review skill.
 *
 *   npx tsx runner/poll.ts
 *     → prints CLAIMED <json> or QUEUE_EMPTY
 */
import { sql } from "drizzle-orm";
import { loadEnv } from "./lib/env";
import { getDb } from "../lib/db";

loadEnv();

/** Minutes after which a claimed-but-never-started request is requeued. */
const STALE_CLAIM_MINUTES = 30;

/**
 * Requeue requests that were claimed but never advanced to 'running' (the
 * worker session died before `run.ts create --request`), so a lost claim can't
 * strand a request in 'claimed' forever.
 */
export async function requeueStaleClaims(): Promise<number> {
  const db = await getDb();
  const result = await db.execute(sql`
    UPDATE run_requests
    SET status = 'queued', claimed_at = NULL
    WHERE status = 'claimed'
      AND run_id IS NULL
      AND claimed_at < now() - (${STALE_CLAIM_MINUTES} * interval '1 minute')
    RETURNING id
  `);
  return ((result as unknown as { rows?: unknown[] }).rows ?? []).length;
}

export async function claimNext(): Promise<Record<string, unknown> | null> {
  await requeueStaleClaims();
  const db = await getDb();
  const result = await db.execute(sql`
    UPDATE run_requests
    SET status = 'claimed', claimed_at = now()
    WHERE id = (
      SELECT id FROM run_requests
      WHERE status = 'queued'
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, personas, note, requested_by, created_at
  `);
  const rows = (result as unknown as { rows?: Record<string, unknown>[] }).rows ?? [];
  return rows[0] ?? null;
}

async function main(): Promise<void> {
  const claimed = await claimNext();
  if (!claimed) {
    console.log("QUEUE_EMPTY");
    return;
  }
  console.log(`CLAIMED ${JSON.stringify(claimed)}`);
}

// Only run as a script (the queue-claim unit test imports claimNext).
if (process.argv[1]?.endsWith("poll.ts")) {
  main().catch((e) => {
    console.error(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
}
