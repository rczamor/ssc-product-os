/**
 * Accuracy-strip math (Phase 2). Turns a run's findings + human reviews into the
 * "what the AI got right / how we caught what it didn't" evidence: the human
 * agree-rate on agent findings, the judge's mean specificity/actionability, and
 * the schema-gate guarantee. Pure and side-effect free so it's unit-testable and
 * shared by the page + API.
 */

export interface FindingForAccuracy {
  key: string;
  persona: string;
  origin: string; // agent | human
  specificityScore: number | null;
  actionabilityScore: number | null;
}

export interface ReviewForAccuracy {
  findingKey: string;
  persona: string;
  reviewerType: string; // human | agent
  verdict: string; // up | down
}

export interface Accuracy {
  agentFindings: number;
  humanFindings: number;
  /** Distinct agent findings that received at least one human vote. */
  agentFindingsReviewed: number;
  /** Human up-votes / human votes, over agent findings. Null if no votes yet. */
  agreeRate: number | null;
  agreeCount: number;
  humanVotesOnAgent: number;
  meanSpecificity: number | null;
  meanActionability: number | null;
  /** Judge-scored agent findings (denominator for the means). */
  judgedCount: number;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

export function computeAccuracy(
  findings: FindingForAccuracy[],
  reviews: ReviewForAccuracy[],
): Accuracy {
  const agent = findings.filter((f) => f.origin !== "human");
  const human = findings.filter((f) => f.origin === "human");
  const agentKeys = new Set(agent.map((f) => `${f.persona}:${f.key}`));

  const humanVotesOnAgent = reviews.filter(
    (r) => r.reviewerType === "human" && agentKeys.has(`${r.persona}:${r.findingKey}`),
  );
  const agreeCount = humanVotesOnAgent.filter((r) => r.verdict === "up").length;
  const reviewedKeys = new Set(humanVotesOnAgent.map((r) => `${r.persona}:${r.findingKey}`));

  const spec = agent
    .map((f) => f.specificityScore)
    .filter((x): x is number => typeof x === "number");
  const act = agent
    .map((f) => f.actionabilityScore)
    .filter((x): x is number => typeof x === "number");

  return {
    agentFindings: agent.length,
    humanFindings: human.length,
    agentFindingsReviewed: reviewedKeys.size,
    agreeRate: humanVotesOnAgent.length > 0 ? agreeCount / humanVotesOnAgent.length : null,
    agreeCount,
    humanVotesOnAgent: humanVotesOnAgent.length,
    meanSpecificity: mean(spec),
    meanActionability: mean(act),
    judgedCount: spec.length,
  };
}
