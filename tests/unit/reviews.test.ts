import { describe, expect, it } from "vitest";
import { computeAccuracy } from "@/lib/reviews";

const agentFinding = (key: string, persona: string, spec: number | null, act: number | null) => ({
  key,
  persona,
  origin: "agent",
  specificityScore: spec,
  actionabilityScore: act,
});

describe("computeAccuracy", () => {
  it("computes agree-rate over human votes on agent findings only", () => {
    const findings = [
      agentFinding("a", "ciso", 4, 5),
      agentFinding("b", "ciso", 2, 3),
      { key: "h", persona: "ciso", origin: "human", specificityScore: null, actionabilityScore: null },
    ];
    const reviews = [
      { findingKey: "a", persona: "ciso", reviewerType: "human", verdict: "up" },
      { findingKey: "b", persona: "ciso", reviewerType: "human", verdict: "down" },
      // A vote on the human-origin finding must NOT count toward agent agree-rate.
      { findingKey: "h", persona: "ciso", reviewerType: "human", verdict: "up" },
    ];
    const acc = computeAccuracy(findings, reviews);
    expect(acc.agentFindings).toBe(2);
    expect(acc.humanFindings).toBe(1);
    expect(acc.humanVotesOnAgent).toBe(2);
    expect(acc.agreeCount).toBe(1);
    expect(acc.agreeRate).toBe(0.5);
    expect(acc.agentFindingsReviewed).toBe(2);
  });

  it("averages judge scores over agent findings and ignores nulls", () => {
    const acc = computeAccuracy(
      [agentFinding("a", "vrm", 4, 5), agentFinding("b", "vrm", 2, null)],
      [],
    );
    expect(acc.meanSpecificity).toBe(3); // (4+2)/2
    expect(acc.meanActionability).toBe(5); // only one non-null
    expect(acc.judgedCount).toBe(2);
    expect(acc.agreeRate).toBeNull(); // no votes yet
  });

  it("does not double-count multiple votes across findings", () => {
    const acc = computeAccuracy(
      [agentFinding("a", "ciso", 3, 3), agentFinding("a", "vrm", 3, 3)],
      [
        { findingKey: "a", persona: "ciso", reviewerType: "human", verdict: "up" },
        { findingKey: "a", persona: "vrm", reviewerType: "human", verdict: "up" },
      ],
    );
    // Same key different persona → two distinct findings, both agreed.
    expect(acc.agentFindingsReviewed).toBe(2);
    expect(acc.agreeRate).toBe(1);
  });
});
