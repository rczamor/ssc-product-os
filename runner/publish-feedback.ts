/**
 * Validates and publishes ingested customer feedback into feedback_items.
 *
 *   npx tsx runner/publish-feedback.ts --file data/feedback-seed.json --validate-only
 *     Validate the file against FeedbackFileSchema. Prints VALID or the exact
 *     zod issues.
 *
 *   npx tsx runner/publish-feedback.ts --file data/feedback-seed.json
 *     Upsert every item into feedback_items. Idempotent on dedupe_key
 *     (source_url when present, else a content hash) — re-running skips what
 *     already exists and reports inserted vs. skipped counts.
 *
 *   npx tsx runner/publish-feedback.ts --source g2
 *     Shorthand for --file runs/feedback/g2.json (the scraper's output).
 *
 * Defaults to data/feedback-seed.json so a fresh database always has the demo
 * corpus even when a live scrape was blocked by a bot wall.
 */
import path from "path";
import { sql } from "drizzle-orm";
import { loadEnv } from "./lib/env";
import { arg as argOf, hasFlag as hasFlagOf } from "./lib/args";
import { assertSafeSegment, readJsonFile } from "./lib/session";
import { getDb } from "../lib/db";
import { feedbackItems } from "../lib/db/schema";
import {
  FeedbackFileSchema,
  feedbackDedupeKey,
  guessPersona,
} from "../lib/schemas/feedback";
import { runMain } from "./lib/zod";

loadEnv();

const ARGV = process.argv.slice(2);
const arg = (flag: string) => argOf(ARGV, flag);
const hasFlag = (flag: string) => hasFlagOf(ARGV, flag);

/** Resolve a path and require it to stay inside the repo root. */
function resolveInRepo(p: string): string {
  const root = path.resolve(process.cwd());
  const resolved = path.resolve(root, p);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`path escapes the repo: ${p}`);
  }
  return resolved;
}

function resolveFile(): string {
  const explicit = arg("--file");
  // Contain --file to the repo (defense-in-depth): this is an operator CLI, but
  // we never want a stray path reading arbitrary files off disk.
  if (explicit) return resolveInRepo(explicit);
  const source = arg("--source");
  if (source) {
    assertSafeSegment("source", source);
    return path.join(process.cwd(), "runs", "feedback", `${source}.json`);
  }
  return path.join(process.cwd(), "data", "feedback-seed.json");
}

async function main(): Promise<void> {
  const file = resolveFile();
  const parsed = FeedbackFileSchema.parse(readJsonFile(file));

  if (hasFlag("--validate-only")) {
    console.log(`VALID (${parsed.items.length} items)`);
    return;
  }

  const db = await getDb();
  let inserted = 0;
  let skipped = 0;

  for (const item of parsed.items) {
    const dedupeKey = feedbackDedupeKey(item);
    const personaGuess = item.personaGuess ?? guessPersona(item.reviewerRoleRaw);
    const rows = await db
      .insert(feedbackItems)
      .values({
        source: item.source,
        sourceUrl: item.sourceUrl ?? null,
        dedupeKey,
        reviewDate: item.reviewDate ?? null,
        rating: item.rating ?? null,
        title: item.title ?? null,
        body: item.body,
        reviewerRoleRaw: item.reviewerRoleRaw ?? null,
        personaGuess,
      })
      // Idempotent: an item already ingested (same dedupe_key) is left as-is.
      .onConflictDoNothing({ target: feedbackItems.dedupeKey })
      .returning({ id: feedbackItems.id });
    if (rows.length > 0) inserted += 1;
    else skipped += 1;
  }

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(feedbackItems);

  console.log(
    `published feedback from ${path.relative(process.cwd(), file)}: ` +
      `${inserted} inserted, ${skipped} already present (${Number(total)} total in feedback_items)`,
  );
}

runMain(main);
