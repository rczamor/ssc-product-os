/**
 * Pushes judge scores (written by the ssc-finding-judge agent to
 * runs/<id>/scores.json) into the findings rows and Langfuse.
 *
 *   npx tsx runner/judge-push.ts --run <id>
 */
import path from "path";
import { and, eq } from "drizzle-orm";
import { loadEnv } from "./lib/env";
import { arg as argOf } from "./lib/args";
import { assertSafeSegment, readJsonFile } from "./lib/session";
import { getDb } from "../lib/db";
import { findings } from "../lib/db/schema";
import { ScoresFileSchema } from "../lib/schemas/findings";
import { personaSpanId, recordScore, flushLangfuse } from "./trace";
import { runMain } from "./lib/zod";

loadEnv();

async function main(): Promise<void> {
  const runId = argOf(process.argv.slice(2), "--run");
  if (!runId) throw new Error("usage: judge-push.ts --run <id>");
  assertSafeSegment("run id", runId);

  const file = path.join(process.cwd(), "runs", runId, "scores.json");
  const parsed = ScoresFileSchema.parse(readJsonFile(file));

  const db = await getDb();
  let missed = 0;
  const matchedScores: number[] = [];
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
    matchedScores.push((s.specificity + s.actionability) / 2);
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

  // Average over MATCHED findings only — a stale/misspelled key must not skew
  // (or fabricate) the run-level metric.
  const matched = matchedScores.length;
  if (matched > 0) {
    const avg = matchedScores.reduce((a, b) => a + b, 0) / matched;
    recordScore({
      runId,
      name: "deliverable_quality",
      value: Number(avg.toFixed(2)),
      comment: `mean of specificity+actionability across ${matched} matched findings`,
    });
    await flushLangfuse();
    console.log(
      `scored ${matched} findings (${missed} unmatched), run-level deliverable_quality=${avg.toFixed(2)}`,
    );
  } else {
    await flushLangfuse();
    console.log(`scored 0 findings (${missed} unmatched) — no deliverable_quality pushed`);
  }
}

runMain(main);
