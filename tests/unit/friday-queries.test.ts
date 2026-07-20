import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { getLatestFridayUpdate, saveFridayUpdate } from "@/lib/db/queries";
import { fridayUpdates } from "@/lib/db/schema";
import { FridayUpdateSchema } from "@/lib/schemas/friday";

const SAMPLE = FridayUpdateSchema.parse({
  generatedAt: "2026-07-17T00:00:00.000Z",
  windowStart: "2026-07-10",
  windowEnd: "2026-07-17",
  shipped: [],
  slipped: [],
  customerImpact: "No customer-facing tickets shipped this window.",
  adoption: "No adoption data generated yet.",
  velocity: "No Linear board synced yet.",
  aiUsage: { containmentRatePercent: null, workflowsRunCount: 0, agreeRatePercent: null, narrative: "No AI usage recorded yet." },
  risks: ["No material risks flagged this window."],
  oneWin: "The review-gate loop caught and fixed every finding before merge.",
});

describe("saveFridayUpdate / getLatestFridayUpdate", () => {
  it("round-trips a saved update", async () => {
    await saveFridayUpdate(SAMPLE);
    const loaded = await getLatestFridayUpdate();
    expect(loaded).toEqual(SAMPLE);
  });

  it("regenerating replaces cleanly — never more than one stored row", async () => {
    await saveFridayUpdate(SAMPLE);
    await saveFridayUpdate({ ...SAMPLE, generatedAt: "2026-07-24T00:00:00.000Z", windowStart: "2026-07-17", windowEnd: "2026-07-24" });
    const db = await getDb();
    const rows = await db.select().from(fridayUpdates);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("latest");
    const loaded = await getLatestFridayUpdate();
    expect(loaded?.windowEnd).toBe("2026-07-24");
  });

  it("two concurrent saves both succeed (upsert, not delete-then-insert racing)", async () => {
    // Regression: a delete-then-insert implementation lets two overlapping
    // generations race — one's DELETE can land between the other's DELETE and
    // INSERT, throwing a primary-key violation or leaving no row at all.
    const a = { ...SAMPLE, oneWin: "Concurrent save A produced this win." };
    const b = { ...SAMPLE, oneWin: "Concurrent save B produced this win." };
    await Promise.all([saveFridayUpdate(a), saveFridayUpdate(b)]);

    const db = await getDb();
    const rows = await db.select().from(fridayUpdates);
    expect(rows).toHaveLength(1); // never zero, never duplicated
    const loaded = await getLatestFridayUpdate();
    expect([a.oneWin, b.oneWin]).toContain(loaded?.oneWin);
  });

  it("degrades to null (not a throw) when the stored body fails the current schema", async () => {
    const db = await getDb();
    await db
      .insert(fridayUpdates)
      .values({ id: "latest", body: { generatedAt: "not-even-close-to-a-valid-update" }, generatedAt: new Date() })
      .onConflictDoUpdate({
        target: fridayUpdates.id,
        set: { body: { generatedAt: "not-even-close-to-a-valid-update" }, generatedAt: new Date() },
      });
    const loaded = await getLatestFridayUpdate();
    expect(loaded).toBeNull();
  });
});
