import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let dbPromise: Promise<Db> | null = null;

/**
 * Single DB entry point for the app, the runner, and tests.
 *
 * - `DATABASE_URL` set and `USE_PGLITE` unset → Neon serverless (HTTP driver).
 * - Otherwise → in-process PGlite (real Postgres, in-memory unless
 *   `PGLITE_DATA_DIR` points at a directory), auto-migrated from ./drizzle
 *   and optionally seeded when `PGLITE_SEED=1`. This is what tests, CI, and
 *   the not-yet-configured deployed app run on.
 */
export function getDb(): Promise<Db> {
  if (!dbPromise) dbPromise = init();
  return dbPromise;
}

async function init(): Promise<Db> {
  const usePglite = process.env.USE_PGLITE === "1" || !process.env.DATABASE_URL;
  if (usePglite) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const path = await import("path");
    const client = process.env.PGLITE_DATA_DIR
      ? new PGlite(process.env.PGLITE_DATA_DIR)
      : new PGlite();
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
  const sql = neon(process.env.DATABASE_URL!);
  return drizzle(sql, { schema }) as unknown as Db;
}

/** True when the app is running against a real (Neon) database. */
export function isPersistentDb(): boolean {
  return Boolean(process.env.DATABASE_URL) && process.env.USE_PGLITE !== "1";
}
