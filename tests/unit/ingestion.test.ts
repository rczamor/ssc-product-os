import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { seed } from "@/lib/db/seed";
import { getIngestionSummary } from "@/lib/db/queries";

beforeAll(async () => {
  const db = await getDb();
  await seed(db);
});

describe("getIngestionSummary", () => {
  it("reports connected review sources and available connector stubs", async () => {
    const summary = await getIngestionSummary();

    expect(summary.totalItems).toBeGreaterThanOrEqual(1);

    // The demo seed ingests review-site sources, so at least one is connected.
    const connected = summary.sources.filter((s) => s.connected);
    expect(connected.length).toBeGreaterThanOrEqual(1);
    expect(connected.every((s) => s.count > 0 && s.lastUpdated !== null)).toBe(true);

    // Connector targets (pendo/gong/gainsight/snowflake) have no data → available stubs.
    const snowflake = summary.sources.find((s) => s.source === "snowflake");
    expect(snowflake).toBeDefined();
    expect(snowflake?.connected).toBe(false);
    expect(snowflake?.kind).toBe("connector");

    // Persona counts sum to the total items (unmapped bucket included).
    const summed = Object.values(summary.personaCounts).reduce((a, b) => a + b, 0);
    expect(summed).toBe(summary.totalItems);
  });
});
