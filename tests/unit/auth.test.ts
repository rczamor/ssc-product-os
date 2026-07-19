import { describe, expect, it } from "vitest";
import { makeSessionToken, timingSafeEqual, verifySessionToken } from "@/lib/auth";

describe("auth tokens", () => {
  it("round-trips a token for the right secret", async () => {
    const token = await makeSessionToken("secret-a");
    expect(await verifySessionToken(token, "secret-a")).toBe(true);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await makeSessionToken("secret-a");
    expect(await verifySessionToken(token, "secret-b")).toBe(false);
  });

  it("rejects tampered and missing tokens", async () => {
    const token = await makeSessionToken("secret-a");
    const tampered = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
    expect(await verifySessionToken(tampered, "secret-a")).toBe(false);
    expect(await verifySessionToken(undefined, "secret-a")).toBe(false);
    expect(await verifySessionToken(token, undefined)).toBe(false);
  });

  it("timingSafeEqual compares correctly", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});
