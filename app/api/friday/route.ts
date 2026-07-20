import { NextResponse } from "next/server";
import { buildFridayUpdate } from "@/lib/friday-update";
import { loadFeatureTaxonomy, loadMetricsRegistry } from "@/lib/metrics";
import { getFridayInputs, getLatestFridayUpdate, saveFridayUpdate } from "@/lib/db/queries";
import { FridayUpdateSchema } from "@/lib/schemas/friday";

export const dynamic = "force-dynamic";

/** GET — the most recently generated Friday Update, or { update: null } before the first one. */
export async function GET() {
  const update = await getLatestFridayUpdate();
  return NextResponse.json({ update });
}

/**
 * POST — generate a fresh Friday Update from the live board + metrics dataset +
 * current run's findings, and store it (replacing any prior one wholesale —
 * "regenerating replaces cleanly" per spec). Auth is enforced by middleware.
 */
export async function POST() {
  try {
    const inputs = await getFridayInputs();
    const features = loadFeatureTaxonomy();
    const registry = loadMetricsRegistry();
    const draft = buildFridayUpdate({ ...inputs, features, registry }, new Date());
    const update = FridayUpdateSchema.parse(draft);
    await saveFridayUpdate(update);
    return NextResponse.json({ update });
  } catch (e) {
    console.error("friday update generation failed:", e);
    return NextResponse.json({ error: "generation failed — see server logs" }, { status: 500 });
  }
}
