import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { findings, runs } from "@/lib/db/schema";
import { isUuid } from "@/lib/validation";
import { CreateHumanFindingSchema } from "@/lib/schemas/review";

export const dynamic = "force-dynamic";

/** Slugify a title into a unique finding key with a human- prefix. */
function humanKey(title: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "note";
  // Random (not time-based) suffix so two same-title submits can't collide on
  // the (run, persona, key) unique index within the same millisecond.
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `human-${slug}-${suffix}`.slice(0, 64);
}

/**
 * POST /api/runs/[id]/findings — add a human-authored finding to a run. Held to
 * the same content contract as agent findings (CreateHumanFindingSchema mirrors
 * the min-length/enum guards); stamped origin='human' so the UI attributes it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "run not found" }, { status: 404 });

  const parsed = CreateHumanFindingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid finding", issues: parsed.error.issues }, { status: 400 });
  }

  const db = await getDb();
  const [run] = await db.select({ id: runs.id }).from(runs).where(eq(runs.id, id));
  if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });

  const f = parsed.data;
  const isDislike = f.kind === "dislike";
  try {
    const [row] = await db
      .insert(findings)
      .values({
        runId: id,
        persona: f.persona,
        key: humanKey(f.title),
        kind: f.kind,
        title: f.title,
        detail: f.detail,
        customerPain: isDislike ? f.customerPain ?? null : null,
        jtbd: f.jtbd,
        rootCause: isDislike ? f.rootCause ?? null : null,
        effort: isDislike ? f.effort ?? null : null,
        firstAction: isDislike ? f.firstAction ?? null : null,
        severity: isDislike ? f.severity ?? null : null,
        // Human-chosen Recommend verdict when supplied; otherwise leave null and
        // let the query layer derive it (likes→double_down, dislikes→KFD).
        verdict: f.verdict ?? (f.kind === "like" ? "double_down" : null),
        origin: "human",
        screenshotIds: [],
        raw: f,
      })
      .returning();
    return NextResponse.json({ finding: row }, { status: 201 });
  } catch (e) {
    // Extremely unlikely key collision on the unique index — surface a 409
    // rather than an unhandled 500.
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json({ error: "duplicate finding key, retry" }, { status: 409 });
    }
    throw e;
  }
}
