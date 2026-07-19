import { describe, expect, it } from "vitest";
import path from "path";
import { assertSafeSegment, resolveInRuns } from "@/runner/lib/session";

describe("resolveInRuns", () => {
  it("resolves a legitimate run-relative screenshot path", () => {
    const p = resolveInRuns("runs/abc/ciso/home.jpg");
    expect(p).toBe(path.resolve(process.cwd(), "runs/abc/ciso/home.jpg"));
  });
  it("rejects traversal out of runs/", () => {
    expect(() => resolveInRuns("../../.env.local")).toThrow(/escapes runs/);
    expect(() => resolveInRuns("runs/../.env.local")).toThrow(/escapes runs/);
    expect(() => resolveInRuns("/etc/passwd")).toThrow(/escapes runs/);
  });
});

describe("assertSafeSegment", () => {
  it("accepts slugs and uuids", () => {
    expect(assertSafeSegment("run id", "8112a07d-5030-4516-ab2c-7e82ae2b3864")).toBeTruthy();
    expect(assertSafeSegment("persona", "gtm_cs")).toBe("gtm_cs");
  });
  it("rejects path-injection segments", () => {
    expect(() => assertSafeSegment("run id", "../x")).toThrow(/unsafe/);
    expect(() => assertSafeSegment("persona", "a/b")).toThrow(/unsafe/);
    expect(() => assertSafeSegment("persona", "")).toThrow(/unsafe/);
  });
});
