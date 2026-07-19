/**
 * Pushes judge scores (written by the ssc-finding-judge agent to
 * runs/<id>/scores.json) into the findings rows and Langfuse.
 *
 *   npx tsx runner/judge-push.ts --run <id>
 */
import fs from "fs";
import path from "path";
import { and, eq } from "drizzle-orm";
import { loadEnv } from "./lib/env";
import { getDb } from "../lib/db";
import { findings } from "../lib/db/schema";
import { ScoresFileSchema } from "../lib/schemas/findings";
import { personaSpanId, recordScore, flushLangfuse } from "./trace";

loadEnv();

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const runId = arg("--run");
  if (!runId) throw new Error("usage: judge-push.ts --run <id>");

  const file = path.join(process.cwd(), "runs", runId, "scores.json");
  if (!fs.existsSync(file)) throw new Error(`missing ${file}`);
  const parsed = ScoresFileSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));

  const db = await getDb();
  let matched = 0;
  let missed = 0;
  for (const s of parsed.scores) {
    const rows = await db
      .update(findings)
      .set({ specificityScore: s.specificity, actionabilityScore: s.actionability })
      .where(
        and(
          eq(findings.runId, runId),
          eq(findings.persona, s.persona),
          eq(findings.key, s.key),
        ),
      )
      .returning({ id: findings.id });
    if (rows.length === 0) {
      missed++;
      console.warn(`no finding matches ${s.persona}/${s.key}`);
      continue;
    }
    matched++;
    recordScore({
      runId,
      observationId: personaSpanId(runId, s.persona),
      name: "specificity",
      value: s.specificity,
      comment: `${s.persona}/${s.key}${s.comment ? ` — ${s.comment}` : ""}`,
    });
    recordScore({
      runId,
      observationId: personaSpanId(runId, s.persona),
      name: "actionability",
      value: s.actionability,
      comment: `${s.persona}/${s.key}`,
    });
  }

  const avg =
    parsed.scores.reduce((acc, s) => acc + (s.specificity + s.actionability) / 2, 0) /
    parsed.scores.length;
  recordScore({
    runId,
    name: "deliverable_quality",
    value: Number(avg.toFixed(2)),
    comment: `mean of specificity+actionability across ${parsed.scores.length} findings`,
  });

  await flushLangfuse();
  console.log(
    `scored ${matched} findings (${missed} unmatched), run-level deliverable_quality=${avg.toFixed(2)}`,
  );
}

main().catch((e) => {
  console.error(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
