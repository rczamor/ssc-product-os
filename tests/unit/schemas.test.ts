import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  DeliverableSchema,
  DislikeSchema,
  PersonaOutputSchema,
  ScoresFileSchema,
} from "@/lib/schemas/findings";

const fixture = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", name), "utf8"));

describe("PersonaOutputSchema", () => {
  it("accepts a well-formed persona output", () => {
    const parsed = PersonaOutputSchema.parse(fixture("persona-output.valid.json"));
    expect(parsed.persona).toBe("ciso");
    expect(parsed.likes.length).toBeGreaterThanOrEqual(2);
    expect(parsed.dislikes.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects vague, malformed, and duplicate-key output", () => {
    const result = PersonaOutputSchema.safeParse(fixture("persona-output.invalid.json"));
    expect(result.success).toBe(false);
    if (result.success) return;
    const messages = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    // Vague content trips min-length guards.
    expect(messages.some((m) => m.startsWith("summary"))).toBe(true);
    // Invalid enums are rejected.
    expect(messages.some((m) => m.includes("rootCause"))).toBe(true);
    expect(messages.some((m) => m.includes("effort"))).toBe(true);
    // Severity is bounded 1-5.
    expect(messages.some((m) => m.includes("severity"))).toBe(true);
  });

  it("rejects duplicate finding keys", () => {
    const valid = fixture("persona-output.valid.json");
    valid.dislikes[1].key = valid.dislikes[0].key;
    const result = PersonaOutputSchema.safeParse(valid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("duplicate finding keys"))).toBe(
        true,
      );
    }
  });

  it("requires dislikes to carry the full issue metadata", () => {
    const bare = {
      key: "some-issue",
      kind: "dislike",
      title: "Something is wrong here",
      detail: "A concrete observation that is long enough to pass the detail length gate.",
    };
    expect(DislikeSchema.safeParse(bare).success).toBe(false);
  });
});

describe("DeliverableSchema", () => {
  it("accepts the exact 3/5/≥5 shape", () => {
    const parsed = DeliverableSchema.parse(fixture("deliverable.valid.json"));
    expect(parsed.likes).toHaveLength(3);
    expect(parsed.dislikes).toHaveLength(5);
    expect(parsed.kfd.length).toBeGreaterThanOrEqual(5);
  });

  it("rejects wrong counts", () => {
    const d = fixture("deliverable.valid.json");
    d.likes.pop();
    expect(DeliverableSchema.safeParse(d).success).toBe(false);
  });
});

describe("ScoresFileSchema", () => {
  it("accepts judge scores and bounds the scale", () => {
    expect(
      ScoresFileSchema.safeParse({
        scores: [{ persona: "vrm", key: "a-key", specificity: 5, actionability: 1 }],
      }).success,
    ).toBe(true);
    expect(
      ScoresFileSchema.safeParse({
        scores: [{ persona: "vrm", key: "a-key", specificity: 6, actionability: 1 }],
      }).success,
    ).toBe(false);
  });
});
