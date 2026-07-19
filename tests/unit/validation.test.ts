import { describe, expect, it } from "vitest";
import { formatTimestamp, isUuid } from "@/lib/validation";

describe("isUuid", () => {
  it("accepts canonical UUIDs", () => {
    expect(isUuid("8112a07d-5030-4516-ab2c-7e82ae2b3864")).toBe(true);
    expect(isUuid("00000000-0000-4000-8000-000000000000")).toBe(true);
  });
  it("rejects non-UUIDs that would otherwise reach Postgres", () => {
    expect(isUuid("abc")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("8112a07d-5030-4516-ab2c")).toBe(false);
    expect(isUuid("../../etc/passwd")).toBe(false);
  });
});

describe("formatTimestamp", () => {
  it("formats Date and ISO string identically", () => {
    const d = new Date("2026-07-19T05:03:12.000Z");
    expect(formatTimestamp(d)).toBe("2026-07-19 05:03");
    expect(formatTimestamp("2026-07-19T05:03:12.000Z")).toBe("2026-07-19 05:03");
  });
  it("returns empty string for null/invalid", () => {
    expect(formatTimestamp(null)).toBe("");
    expect(formatTimestamp(undefined)).toBe("");
    expect(formatTimestamp("not a date")).toBe("");
  });
});
