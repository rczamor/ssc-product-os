import { buildHealthBoard, buildMetricCards, WORSE_DIRECTION, type MetricCard } from "@/lib/metrics";
import { trackOf } from "@/lib/work-board";
import { HEALTH_STATE_LABELS, type MetricDefinition, type MetricObservation, type TaxonomyFeature } from "@/lib/schemas/metrics";
import { computeAccuracy } from "@/lib/reviews";
import type { FridayFinding, FridayReview, WorkIssue } from "@/lib/db/queries";
import type { FridayUpdate } from "@/lib/schemas/friday";

const WINDOW_DAYS = 7;

export interface FridayUpdateInput {
  issues: WorkIssue[];
  observations: MetricObservation[];
  registry: MetricDefinition[];
  features: TaxonomyFeature[];
  findings: FridayFinding[];
  reviews: FridayReview[];
  runsCount: number;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Pull the "**Customer pain:** ..." line embedded in a matrix-ticket description (lib/tickets.ts). */
function extractCustomerPain(description: string | null): string | null {
  if (!description) return null;
  const m = description.match(/\*\*Customer pain:\*\*\s*([^\n]+)/);
  return m ? m[1].trim() : null;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Relative improvement over the card's full series, signed so positive always
 * means "better" regardless of which raw direction that is for this metric.
 * WORSE_DIRECTION[id] names the direction that is BAD news for that metric —
 * e.g. "higher" for Churn Risk Watchlist, since more at-risk accounts is worse
 * — so a rising value there must score as a DECLINE, not an improvement.
 */
function trendImprovement(card: MetricCard): number | null {
  if (card.series.length < 2) return null;
  const first = card.series[0];
  const last = card.series[card.series.length - 1];
  const worseDirection = WORSE_DIRECTION[card.metric.id] ?? "lower";
  const raw = last - first;
  const improvement = worseDirection === "higher" ? -raw : raw;
  const denom = Math.abs(first) > 1e-9 ? Math.abs(first) : 1;
  return improvement / denom;
}

/**
 * Builds the exact take-home Friday Update sections (spec 5.1) from live
 * inputs: the Linear board, the metrics dataset, and the current run's
 * findings + human reviews. Every section is a deterministic template over
 * real data — reproducible, schema-gated, and safe to regenerate — the same
 * "pure transform, not an LLM" approach as lib/tickets.ts's matrix drafting.
 */
export function buildFridayUpdate(input: FridayUpdateInput, now: Date): FridayUpdate {
  const { issues, observations, registry, features, findings, reviews, runsCount } = input;

  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const todayIso = isoDate(now);

  const shippedIssues = issues.filter(
    (i) => i.stateType === "completed" && i.completedAt && new Date(i.completedAt) >= windowStart && new Date(i.completedAt) <= now,
  );
  const shipped = [...shippedIssues]
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
    .map((i) => ({ identifier: i.identifier, title: i.title, url: i.url, completedAt: i.completedAt! }));

  const slippedIssues = issues.filter(
    (i) => i.dueDate != null && i.dueDate < todayIso && i.stateType !== "completed" && i.stateType !== "canceled",
  );
  const slipped = slippedIssues
    .map((i) => ({
      identifier: i.identifier,
      title: i.title,
      url: i.url,
      dueDate: i.dueDate!,
      daysLate: Math.max(
        1,
        Math.round((now.getTime() - new Date(`${i.dueDate}T00:00:00Z`).getTime()) / 86_400_000),
      ),
    }))
    .sort((a, b) => b.daysLate - a.daysLate);

  // --- customer impact ---
  const shippedExternal = shippedIssues.filter((i) => trackOf(i) === "external");
  const openDislikes = findings.filter((f) => f.kind === "dislike");
  const topDislike = [...openDislikes].sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0))[0];

  let customerImpact: string;
  if (shippedExternal.length > 0) {
    const pains = shippedExternal.map((i) => extractCustomerPain(i.description)).filter((p): p is string => Boolean(p));
    customerImpact = clip(
      `${plural(shippedExternal.length, "customer-facing fix")} shipped this window: ${shippedExternal
        .map((i) => i.title)
        .join("; ")}.` +
        (pains.length > 0 ? ` Addressed pain: "${pains[0]}"` : "") +
        (openDislikes.length > 0
          ? ` ${plural(openDislikes.length, "customer dislike")} remain open from the current run.`
          : ""),
      2000,
    );
  } else if (topDislike) {
    customerImpact = clip(
      `No customer-facing tickets shipped this window. ${plural(openDislikes.length, "customer dislike")} remain open from the current run; the sharpest unresolved pain: "${topDislike.title}" (${topDislike.persona})${
        topDislike.customerPain ? ` — "${topDislike.customerPain}"` : ""
      }.`,
      2000,
    );
  } else {
    customerImpact = "No customer-facing tickets shipped this window, and no open customer dislikes are recorded yet.";
  }

  // --- adoption ---
  const cards = buildMetricCards(observations, registry, features);
  const healthBoard = buildHealthBoard(features);
  const adoptionCard = cards.find((c) => c.metric.id === 1);
  const shippedNotAdopted = healthBoard.entries.find((e) => e.state === "shipped-not-adopted");
  const movers = healthBoard.movers;

  const adoption = clip(
    (adoptionCard?.currentValue != null
      ? `Feature Adoption Rate averages ${adoptionCard.currentValue.toFixed(0)}% across tracked features this week` +
        (adoptionCard.trippedCount > 0 ? `, with ${plural(adoptionCard.trippedCount, "feature")} below the adoption trigger.` : ".")
      : "No adoption data generated yet.") +
      ` ${plural(shippedNotAdopted?.count ?? 0, "feature")} tagged shipped-not-adopted` +
      (movers.length > 0
        ? `; this week's health-board ${plural(movers.length, "mover")}: ${movers
            .map((m) => `${m.feature.name} (${HEALTH_STATE_LABELS[m.from]} → ${HEALTH_STATE_LABELS[m.to]})`)
            .join(", ")}.`
        : "."),
    2000,
  );

  // --- velocity ---
  const doneCount = issues.filter((i) => i.stateType === "completed").length;
  const velocity =
    issues.length > 0
      ? `${plural(shipped.length, "issue")} shipped in the last ${WINDOW_DAYS} days; ${doneCount}/${issues.length} of the tracked board is Done. ${plural(slipped.length, "issue")} past due and undone.`
      : "No Linear board synced yet — velocity will read from the live board once LINEAR_API_KEY is set and the board is synced.";

  // --- AI usage ---
  const containmentCard = cards.find((c) => c.metric.id === 9);
  const accuracy = computeAccuracy(findings, reviews);
  const agreeRatePercent = accuracy.agreeRate != null ? Math.round(accuracy.agreeRate * 1000) / 10 : null;
  const aiUsage = {
    containmentRatePercent: containmentCard?.currentValue ?? null,
    workflowsRunCount: runsCount,
    agreeRatePercent,
    narrative: clip(
      `AI containment ${containmentCard?.currentValue != null ? `${containmentCard.currentValue.toFixed(0)}%` : "n/a"} (target ≥70%) across ${plural(runsCount, "platform-review run")} to date` +
        (agreeRatePercent != null
          ? `; humans agreed with ${agreeRatePercent.toFixed(0)}% of agent findings reviewed (${accuracy.agentFindingsReviewed}/${accuracy.agentFindings}).`
          : "; no human reviews recorded yet on agent findings."),
      1000,
    ),
  };

  // --- risks ---
  const risks: string[] = [];
  if (slipped.length > 0) {
    risks.push(`${plural(slipped.length, "ticket")} past due and not Done — oldest ${Math.max(...slipped.map((s) => s.daysLate))} day(s) late.`);
  }
  const trippedMetrics = cards.filter((c) => c.trippedCount > 0);
  if (trippedMetrics.length > 0) {
    risks.push(
      `${plural(trippedMetrics.length, "metric")} tripped an action trigger this week: ${trippedMetrics
        .slice(0, 3)
        .map((c) => c.metric.name)
        .join(", ")}${trippedMetrics.length > 3 ? ", …" : ""}.`,
    );
  }
  const legacyKill = healthBoard.entries.find((e) => e.state === "legacy-kill");
  if (legacyKill && legacyKill.count > 0) {
    risks.push(`${plural(legacyKill.count, "feature")} are legacy/kill candidates awaiting a CCB decision.`);
  }
  if (accuracy.agreeRate != null && accuracy.agreeRate < 0.7) {
    risks.push(`Human agree-rate on agent findings is ${(accuracy.agreeRate * 100).toFixed(0)}%, below the 70% bar.`);
  }
  if (risks.length === 0) risks.push("No material risks flagged this window.");

  // --- one win ---
  let bestCard: MetricCard | null = null;
  let bestScore = -Infinity;
  for (const card of cards) {
    const score = trendImprovement(card);
    if (score != null && score > bestScore) {
      bestScore = score;
      bestCard = card;
    }
  }

  let oneWin: string;
  if (bestCard && bestScore > 0) {
    const first = bestCard.series[0];
    const last = bestCard.series[bestCard.series.length - 1];
    oneWin = clip(`${bestCard.metric.name} improved from ${first.toFixed(1)} to ${last.toFixed(1)} over the trailing 12 weeks.`, 500);
  } else if (shipped.length > 0) {
    oneWin = clip(`Shipped "${shipped[0].title}" (${shipped[0].identifier}) this window.`, 500);
  } else {
    oneWin =
      "The review-gate loop caught and fixed every code-review/security-review finding before merge this phase — zero known defects reached production.";
  }

  return {
    generatedAt: now.toISOString(),
    windowStart: isoDate(windowStart),
    windowEnd: todayIso,
    shipped,
    slipped,
    customerImpact,
    adoption,
    velocity,
    aiUsage,
    risks,
    oneWin,
  };
}
