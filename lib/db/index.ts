import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** True when we should use in-process PGlite rather than Neon. */
function shouldUsePglite(): boolean {
  return process.env.USE_PGLITE === "1" || !process.env.DATABASE_URL;
}

/**
 * Where a PGlite fallback stores data. Tests/CI force in-memory by setting
 * PGLITE_DATA_DIR="" (defined-but-empty). Otherwise a file dir so the runner's
 * many short-lived processes share one database; empty string → in-memory.
 */
function pgliteDataDir(): string | undefined {
  const explicit = process.env.PGLITE_DATA_DIR;
  if (explicit !== undefined) return explicit === "" ? undefined : explicit;
  return process.env.USE_PGLITE === "1" ? undefined : ".pglite-data";
}

// Cache on globalThis so Next.js route-handler lambdas and dev-mode HMR reuse
// one PGlite instance instead of each booting a separate empty database.
const globalForDb = globalThis as unknown as { __sscDbPromise?: Promise<Db> | null };

/**
 * Single DB entry point for the app, the runner, and tests.
 *
 * - `DATABASE_URL` set and `USE_PGLITE` unset → Neon serverless (HTTP driver).
 * - Otherwise → in-process PGlite (real Postgres; file-backed by default so
 *   runner processes share state, in-memory when PGLITE_DATA_DIR=""),
 *   auto-migrated from ./drizzle and optionally seeded when `PGLITE_SEED=1`.
 */
export function getDb(): Promise<Db> {
  if (!globalForDb.__sscDbPromise) {
    const p = init();
    // Never memoize a rejection: a transient init failure must not poison every
    // later call for the life of the process/lambda.
    p.catch(() => {
      if (globalForDb.__sscDbPromise === p) globalForDb.__sscDbPromise = null;
    });
    globalForDb.__sscDbPromise = p;
  }
  return globalForDb.__sscDbPromise;
}

async function init(): Promise<Db> {
  if (shouldUsePglite()) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const path = await import("path");
    const dataDir = pgliteDataDir();
    const client = dataDir ? new PGlite(dataDir) : new PGlite();
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    if (process.env.PGLITE_SEED === "1") {
      const { seed } = await import("./seed");
      await seed(db as unknown as Db);
    }
    return db as unknown as Db;
  }

  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  const path = await import("path");
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema }) as unknown as Db;

  // Neon has no auto-migration step (unlike the PGlite branch above), so a
  // freshly provisioned DATABASE_URL points at an empty database and every
  // query 500s with `relation "runs" does not exist`. Apply pending migrations
  // on first connect. This is idempotent — drizzle records applied hashes in
  // __drizzle_migrations and skips them next time. neon-http has no
  // transactions, so two cold-start instances can race on the first migration;
  // tolerate "already exists" from the loser and let the winner finish.
  if (process.env.DB_AUTO_MIGRATE !== "0") {
    const { migrate } = await import("drizzle-orm/neon-http/migrator");
    try {
      await migrate(db as never, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/already exists|duplicate/i.test(msg)) throw e;
    }
  }

  // Optional: populate an empty deployed database with the labeled demo run +
  // feedback so the dashboard isn't blank. Off by default (never writes to a
  // real DB uninvited); seed() itself skips if any run already exists.
  if (process.env.DB_SEED_ON_EMPTY === "1") {
    const { seed } = await import("./seed");
    await seed(db);
  }

  return db;
}

/** True when the app is running against a real (Neon) database. */
export function isPersistentDb(): boolean {
  return !shouldUsePglite();
}
