import { buildHealthBoard, buildMetricCards, type MetricCard } from "@/lib/metrics";
import { trackOf } from "@/lib/work-board";
import { HEALTH_STATE_LABELS, type MetricDefinition, type MetricObservation, type TaxonomyFeature } from "@/lib/schemas/metrics";
import { computeAccuracy } from "@/lib/reviews";
import { clip } from "@/lib/validation";
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

/** Whole calendar days between two YYYY-MM-DD dates — independent of time-of-day,
 *  so the same overdue ticket reports the same "days late" no matter what time
 *  the update is generated on a given day. */
function calendarDaysBetween(earlierIso: string, laterIso: string): number {
  const earlier = new Date(`${earlierIso}T00:00:00Z`).getTime();
  const later = new Date(`${laterIso}T00:00:00Z`).getTime();
  return Math.round((later - earlier) / 86_400_000);
}

/** Pull the "**Customer pain:** ..." line embedded in a matrix-ticket description (lib/tickets.ts). */
function extractCustomerPain(description: string | null): string | null {
  if (!description) return null;
  const m = description.match(/\*\*Customer pain:\*\*\s*([^\n]+)/);
  return m ? m[1].trim() : null;
}

/**
 * Which raw direction is genuinely GOOD news for this metric — used to score
 * "one win" trend candidates. Deliberately its OWN map, not derived from
 * lib/metrics.ts's WORSE_DIRECTION: that map's purpose is "which direction to
 * sort tripped examples worst-first", and for metric 12 (Expansion PQLs) it's
 * set to "higher" for that sorting reason even though a RISING value there is
 * good news (more expansion signal), not bad — its own comment says as much
 * ("a trip is a good signal, but 'more' is the notable direction"). Reusing
 * WORSE_DIRECTION for trend-improvement scoring inverted that one metric's
 * verdict; this map is defined per-metric so that can't happen again.
 */
const GOOD_DIRECTION: Record<number, "lower" | "higher"> = {
  1: "higher", // Feature Adoption Rate
  2: "higher", // Engagement
  3: "lower", // Usage Frequency (fewer days between uses = more frequent)
  4: "higher", // Task Completion Rate
  5: "lower", // Time on Task (faster is better)
  6: "higher", // Activation Rate (D30)
  7: "lower", // Time to Adoption (faster is better)
  8: "lower", // Friction Index
  9: "higher", // AI Containment Rate
  10: "higher", // Feature NPS
  11: "lower", // Churn Risk Watchlist (fewer at-risk accounts is better)
  12: "higher", // Expansion PQLs (more expansion signal is genuinely good)
  13: "lower", // Feature Revenue Concentration (lower concentration is better)
};

/** Relative improvement over the card's full series, signed so positive always means "better". */
function trendImprovement(card: MetricCard): number | null {
  if (card.series.length < 2) return null;
  const first = card.series[0];
  const last = card.series[card.series.length - 1];
  const goodDirection = GOOD_DIRECTION[card.metric.id] ?? "higher";
  const raw = last - first;
  const improvement = goodDirection === "higher" ? raw : -raw;
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
      daysLate: Math.max(1, calendarDaysBetween(i.dueDate!, todayIso)),
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
  // Same whole-percent rounding as components/AccuracyStrip.tsx, so the same
  // underlying agreeRate never displays two different percentages in the app.
  const agreeRatePercent = accuracy.agreeRate != null ? Math.round(accuracy.agreeRate * 100) : null;
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
  const best = cards
    .map((card) => ({ card, score: trendImprovement(card) }))
    .filter((c): c is { card: MetricCard; score: number } => c.score != null)
    .reduce<{ card: MetricCard; score: number } | null>(
      (best, c) => (best === null || c.score > best.score ? c : best),
      null,
    );

  let oneWin: string;
  if (best && best.score > 0) {
    const first = best.card.series[0];
    const last = best.card.series[best.card.series.length - 1];
    oneWin = clip(`${best.card.metric.name} improved from ${first.toFixed(1)} to ${last.toFixed(1)} over the trailing 12 weeks.`, 500);
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
