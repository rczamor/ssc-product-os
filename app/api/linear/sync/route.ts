import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isLinearConfigured } from "@/lib/linear";
import { LinearNotConfiguredError, syncProjectToCache } from "@/lib/linear-sync";

export const dynamic = "force-dynamic";

/**
 * POST — refresh the linear_cache from the SSC-ProductOS project. Returns 503
 * (not an error) when LINEAR_API_KEY is unset, so the Work screen degrades to
 * whatever is already cached instead of breaking.
 */
export async function POST() {
  if (!isLinearConfigured()) {
    return NextResponse.json(
      { error: "LINEAR_API_KEY is not set — cannot sync from Linear" },
      { status: 503 },
    );
  }
  try {
    const db = await getDb();
    const { count, skipped } = await syncProjectToCache(db);
    return NextResponse.json({ synced: count, skipped });
  } catch (e) {
    if (e instanceof LinearNotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    // Log the real cause server-side; never echo a raw exception message to the client.
    console.error("linear sync failed:", e);
    return NextResponse.json({ error: "sync failed — see server logs" }, { status: 502 });
  }
}
