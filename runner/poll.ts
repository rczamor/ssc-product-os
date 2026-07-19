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

export async function claimNext(): Promise<Record<string, unknown> | null> {
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
