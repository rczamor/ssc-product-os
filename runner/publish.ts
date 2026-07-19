/**
 * Validates agent output and publishes it to the database + Langfuse.
 *
 *   npx tsx runner/publish.ts --run <id> --persona <p> --validate-only
 *     Validate runs/<id>/<p>/findings.json against PersonaOutputSchema.
 *     Prints VALID or the exact zod issues (agents fix and retry).
 *
 *   npx tsx runner/publish.ts --run <id> --persona <p>
 *     Publish the persona: screenshots (from journey.json + adhoc.json),
 *     persona_evaluation row, findings rows, Langfuse generation.
 *
 *   npx tsx runner/publish.ts --run <id> --deliverable
 *     Validate + publish runs/<id>/deliverable.json, render markdown, store.
 *
 *   npx tsx runner/publish.ts --run <id> --persona <p> --mark-failed
 *     Record the persona evaluation as failed (after retries were exhausted).
 */
import fs from "fs";
import path from "path";
import { and, eq } from "drizzle-orm";
import { loadEnv } from "./lib/env";
import { getDb } from "../lib/db";
import { deliverables, findings, personaEvaluations, screenshots } from "../lib/db/schema";
import { DeliverableSchema, PersonaOutputSchema } from "../lib/schemas/findings";
import { renderDeliverableMarkdown } from "../lib/synthesis";
import { recordGeneration, flushLangfuse } from "./trace";

loadEnv();

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function readJson(file: string): unknown {
  if (!fs.existsSync(file)) throw new Error(`missing file: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`invalid JSON in ${file}: ${e instanceof Error ? e.message : e}`);
  }
}

interface ShotEntry {
  label: string;
  url?: string;
  finalUrl?: string;
  file: string;
  width?: number;
  height?: number;
  status?: string;
}

function collectShots(runId: string, persona: string): ShotEntry[] {
  const dir = path.join(process.cwd(), "runs", runId, persona);
  const entries: ShotEntry[] = [];
  for (const name of ["journey.json", "adhoc.json"]) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;
    const arr = JSON.parse(fs.readFileSync(file, "utf8")) as ShotEntry[];
    entries.push(...arr);
  }
  return entries.filter(
    (e) => e.label && e.file && fs.existsSync(path.join(process.cwd(), e.file)),
  );
}

async function publishPersona(runId: string, persona: string): Promise<void> {
  const dir = path.join(process.cwd(), "runs", runId, persona);
  const parsed = PersonaOutputSchema.parse(readJson(path.join(dir, "findings.json")));
  if (parsed.persona !== persona) {
    throw new Error(`findings.json persona=${parsed.persona} but publishing as ${persona}`);
  }

  const db = await getDb();

  // Screenshots first (idempotent on the (run, persona, label) unique index).
  const labelToId = new Map<string, string>();
  for (const shot of collectShots(runId, persona)) {
    const bytes = fs.readFileSync(path.join(process.cwd(), shot.file));
    const [row] = await db
      .insert(screenshots)
      .values({
        runId,
        persona,
        label: shot.label,
        urlVisited: shot.finalUrl ?? shot.url,
        data: bytes,
        width: shot.width ?? 1440,
        height: shot.height ?? 900,
      })
      .onConflictDoUpdate({
        target: [screenshots.runId, screenshots.persona, screenshots.label],
        set: { data: bytes, urlVisited: shot.finalUrl ?? shot.url },
      })
      .returning({ id: screenshots.id });
    labelToId.set(shot.label, row.id);
  }

  const journeyFile = path.join(dir, "journey.json");
  const journey = fs.existsSync(journeyFile)
    ? (JSON.parse(fs.readFileSync(journeyFile, "utf8")) as Array<Record<string, unknown>>).map(
        (j) => ({ ...j, screenshotId: labelToId.get(String(j.label)) ?? null }),
      )
    : [];

  // Republish is idempotent: replace this persona's rows wholesale.
  await db
    .delete(findings)
    .where(and(eq(findings.runId, runId), eq(findings.persona, persona)));
  await db
    .delete(personaEvaluations)
    .where(and(eq(personaEvaluations.runId, runId), eq(personaEvaluations.persona, persona)));

  await db.insert(personaEvaluations).values({
    runId,
    persona,
    status: "completed",
    summary: parsed.summary,
    journey,
    rawOutput: parsed,
    finishedAt: new Date(),
  });

  const allFindings = [...parsed.likes, ...parsed.dislikes];
  for (const f of allFindings) {
    const shotIds = f.screenshotLabels
      .map((l) => labelToId.get(l))
      .filter((x): x is string => Boolean(x));
    await db.insert(findings).values({
      runId,
      persona,
      key: f.key,
      kind: f.kind,
      title: f.title,
      detail: f.detail,
      customerPain: f.kind === "dislike" ? f.customerPain : null,
      jtbd: f.jtbd,
      rootCause: f.kind === "dislike" ? f.rootCause : null,
      effort: f.kind === "dislike" ? f.effort : null,
      firstAction: f.kind === "dislike" ? f.firstAction : null,
      severity: f.kind === "dislike" ? f.severity : null,
      screenshotIds: shotIds,
      raw: f,
    });
  }

  recordGeneration({
    runId,
    name: `persona-eval-${persona}`,
    persona,
    input: { persona, journeyStops: journey.length },
    output: parsed,
    metadata: { likes: parsed.likes.length, dislikes: parsed.dislikes.length },
  });
  await flushLangfuse();
  console.log(
    `published ${persona}: ${parsed.likes.length} likes, ${parsed.dislikes.length} dislikes, ${labelToId.size} screenshots`,
  );
}

async function publishDeliverable(runId: string): Promise<void> {
  const file = path.join(process.cwd(), "runs", runId, "deliverable.json");
  const parsed = DeliverableSchema.parse(readJson(file));
  const markdown = renderDeliverableMarkdown(parsed, { runId });
  fs.writeFileSync(path.join(process.cwd(), "runs", runId, "deliverable.md"), markdown);

  const db = await getDb();
  await db.delete(deliverables).where(eq(deliverables.runId, runId));
  await db.insert(deliverables).values({
    runId,
    likes: parsed.likes,
    dislikes: parsed.dislikes,
    kfdTable: parsed.kfd,
    markdown,
  });

  recordGeneration({
    runId,
    name: "synthesis",
    input: { source: "persona findings.json ×3" },
    output: parsed,
    metadata: { kfdRows: parsed.kfd.length },
  });
  await flushLangfuse();
  console.log(`published deliverable: 3 likes, 5 dislikes, ${parsed.kfd.length} KFD rows`);
}

async function markFailed(runId: string, persona: string): Promise<void> {
  const db = await getDb();
  await db
    .delete(personaEvaluations)
    .where(and(eq(personaEvaluations.runId, runId), eq(personaEvaluations.persona, persona)));
  await db.insert(personaEvaluations).values({
    runId,
    persona,
    status: "failed",
    finishedAt: new Date(),
  });
  console.log(`marked ${persona} failed`);
}

async function main(): Promise<void> {
  const runId = arg("--run");
  if (!runId) throw new Error("--run <id> is required");
  const persona = arg("--persona");

  if (hasFlag("--deliverable")) {
    if (hasFlag("--validate-only")) {
      DeliverableSchema.parse(readJson(path.join(process.cwd(), "runs", runId, "deliverable.json")));
      console.log("VALID");
      return;
    }
    return publishDeliverable(runId);
  }

  if (!persona) throw new Error("--persona <p> is required (or use --deliverable)");
  if (hasFlag("--mark-failed")) return markFailed(runId, persona);
  if (hasFlag("--validate-only")) {
    const parsed = PersonaOutputSchema.parse(
      readJson(path.join(process.cwd(), "runs", runId, persona, "findings.json")),
    );
    if (parsed.persona !== persona) {
      throw new Error(`findings.json persona=${parsed.persona}, expected ${persona}`);
    }
    console.log("VALID");
    return;
  }
  return publishPersona(runId, persona);
}

main().catch((e) => {
  if (e && typeof e === "object" && "issues" in (e as Record<string, unknown>)) {
    console.error("SCHEMA INVALID — fix these issues in the JSON and retry:");
    for (const issue of (e as { issues: Array<{ path: unknown[]; message: string }> }).issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
  } else {
    console.error(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  }
  process.exit(1);
});
