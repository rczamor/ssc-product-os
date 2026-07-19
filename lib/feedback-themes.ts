import type { FeedbackRow } from "@/lib/db/queries";

/**
 * Honest theme clustering (Phase 1 stub). We bucket ingested feedback into a
 * fixed set of keyword-defined themes rather than running an LLM pass, and we
 * present every theme as a PROPOSED persona update that is explicitly "pending
 * approval". Nothing here mutates persona.md — the personas remain the
 * human-curated source of truth. A later phase can replace the keyword matcher
 * with an embedding/LLM clusterer behind the same interface.
 */

export interface Theme {
  key: string;
  label: string;
  /** Which persona this theme most informs (for a suggested corpus update). */
  personaAffinity: "ciso" | "vrm" | "gtm_cs" | null;
  description: string;
  count: number;
  avgRating: number | null;
  /** Representative item ids (up to 3) for drill-in. */
  sampleIds: string[];
}

interface ThemeDef {
  key: string;
  label: string;
  personaAffinity: Theme["personaAffinity"];
  description: string;
  re: RegExp;
}

const THEME_DEFS: ThemeDef[] = [
  {
    key: "score-volatility",
    label: "Score volatility & change transparency",
    personaAffinity: "ciso",
    description:
      "Grades move (or lag) without a clear 'here is exactly what changed' timeline, creating exec fire drills.",
    re: /volatil|drop|lag|delay|no clear explanation|what changed|fluctuat|took .*weeks|reflect/i,
  },
  {
    key: "attribution-disputes",
    label: "Attribution accuracy & disputes",
    personaAffinity: "ciso",
    description:
      "False-positive attribution (IPs/assets that aren't ours) and a slow, ticket-based dispute path.",
    re: /attribut|false positive|not (ours|our)|dispute|incorrect|wrong ip|belong to|resurfac/i,
  },
  {
    key: "questionnaire-portfolio",
    label: "Questionnaire & portfolio workflow",
    personaAffinity: "vrm",
    description:
      "Questionnaire sending/chasing and bulk portfolio construction are more manual than expected for TPRM.",
    re: /questionnaire|portfolio|atlas|bulk|\bimport\b|onboard(ing)? .*vendor|mapping|entity|supplier list/i,
  },
  {
    key: "reporting-value",
    label: "Board & regulator reporting",
    personaAffinity: "ciso",
    description:
      "Board-ready grades, trend history and peer benchmarking are top-cited value — with requests for more layout control.",
    re: /\bboard\b|audit committee|regulator|report|benchmark|\bpeer|trend|slide|percentile/i,
  },
  {
    key: "remediation-loop",
    label: "Remediation guidance & reverification",
    personaAffinity: "ciso",
    description:
      "Actionable remediation notes are praised; the gap is signalling 'fixed, please reverify' to shorten the loop.",
    re: /remediat|reverif|reassess|\bfix|guidance|actionable|close.?d? loop|what to fix/i,
  },
  {
    key: "pricing-packaging",
    label: "Pricing & packaging",
    personaAffinity: "vrm",
    description:
      "Per-vendor pricing pushes teams to monitor fewer vendors, working against portfolio-wide visibility.",
    re: /pric|cost|expensive|budget|renewal quote|per.?vendor|packag/i,
  },
  {
    key: "gtm-enablement",
    label: "GTM / sales-enablement value",
    personaAffinity: "gtm_cs",
    description:
      "GTM/CS teams use scorecards to clear security objections and frame renewals — asking for shareable formats.",
    re: /sales|deal|prospect|qbr|renewal|account|procurement objection|shareable|enablement|solutions engineer/i,
  },
  {
    key: "integrations-api",
    label: "Integrations & API depth",
    personaAffinity: "vrm",
    description:
      "Connectors into GRC/ticketing cover part of the need; teams build against the API for the rest.",
    re: /integrat|connector|\bapi\b|\bgrc\b|ticketing|sync|flow into/i,
  },
  {
    key: "support-experience",
    label: "Support & service experience",
    personaAffinity: null,
    description:
      "Support quality is a renewal factor; slipping ticket turnaround shows up alongside otherwise-positive reviews.",
    re: /support|ticket turnaround|response time|service experience|slow to respond|csm/i,
  },
];

/**
 * Cluster feedback rows into proposed themes. An item can match several themes
 * (it's tagged into each), reflecting that real reviews touch multiple topics.
 */
export function clusterThemes(items: FeedbackRow[]): Theme[] {
  const acc = new Map<string, { count: number; ratingSum: number; ratingN: number; ids: string[] }>();
  for (const def of THEME_DEFS) acc.set(def.key, { count: 0, ratingSum: 0, ratingN: 0, ids: [] });

  for (const item of items) {
    const hay = `${item.title ?? ""} ${item.body} ${item.reviewerRoleRaw ?? ""}`;
    for (const def of THEME_DEFS) {
      if (!def.re.test(hay)) continue;
      const a = acc.get(def.key)!;
      a.count += 1;
      if (typeof item.rating === "number") {
        a.ratingSum += item.rating;
        a.ratingN += 1;
      }
      if (a.ids.length < 3) a.ids.push(item.id);
    }
  }

  return THEME_DEFS.map((def) => {
    const a = acc.get(def.key)!;
    return {
      key: def.key,
      label: def.label,
      personaAffinity: def.personaAffinity,
      description: def.description,
      count: a.count,
      avgRating: a.ratingN > 0 ? Math.round((a.ratingSum / a.ratingN) * 10) / 10 : null,
      sampleIds: a.ids,
    };
  })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);
}
