/**
 * Seeds Riché's own product-clickthrough Kill/Fix/Double-Down recommendations
 * into a run as HUMAN-authored findings (origin='human'), so they render in the
 * Plan matrix alongside the agent findings and surface under the new
 * Source = Human filter. Sourced from the take-home "Platform Review" notes.
 *
 *   npx tsx runner/seed-human-findings.ts --validate-only
 *     Validate every finding against CreateHumanFindingSchema and print the
 *     plan (verdict spread). No DB write, no run needed.
 *
 *   npx tsx runner/seed-human-findings.ts [--run <uuid>]
 *     Insert the findings into the given run (default: latest completed run).
 *     Idempotent: stable keys + onConflictDoNothing on (run, persona, key), so
 *     re-running never duplicates. Held to the same content contract as the
 *     in-app Add-a-theme path (CreateHumanFindingSchema).
 */
import { desc, eq } from "drizzle-orm";
import { loadEnv } from "./lib/env";
import { hasFlag as hasFlagOf } from "./lib/args";
import { getDb } from "../lib/db";
import { findings, runs } from "../lib/db/schema";
import { CreateHumanFindingSchema, type CreateHumanFinding } from "../lib/schemas/review";
import { runMain } from "./lib/zod";

loadEnv();
const ARGV = process.argv.slice(2);
const hasFlag = (f: string) => hasFlagOf(ARGV, f);
function getArg(flag: string): string | undefined {
  const i = ARGV.indexOf(flag);
  return i >= 0 ? ARGV[i + 1] : undefined;
}

/** A human finding + a STABLE key (idempotent reseed) + optional like blurb. */
interface HumanEntry {
  key: string;
  whyItWorks?: string;
  finding: CreateHumanFinding;
}

const ENTRIES: HumanEntry[] = [
  {
    key: "human-riche-getting-started",
    whyItWorks: "It turns a static report into a to-do list — progress plus the next few things I can do.",
    finding: {
      persona: "ciso",
      kind: "like",
      verdict: "double_down",
      title: "Getting Started guides me to the next action, not just the score",
      detail:
        "The Getting Started page is one of the few surfaces that feels actionable — it highlights the progress I've made and the next few things I can do, which turns a static report into a to-do list. Double down on guided, sequenced next-best-actions; the gap is that it still doesn't surface my top priorities without digging 5–6 layers into the IA.",
      jtbd: "Tell me what to do next to improve my posture, not just where I stand.",
    },
  },
  {
    key: "human-riche-home-hierarchy",
    finding: {
      persona: "ciso",
      kind: "dislike",
      verdict: "fix",
      title: "Home is a wall of numbers with no priority hierarchy",
      customerPain:
        "I open Home to a dense grid of metrics with no hierarchy and no 'so what' — nothing tells me which one or two things matter most right now or why they matter.",
      detail:
        "Every tile competes for attention equally, so the page answers 'here is everything' instead of 'here is what to fix first.' A CISO scanning before a board update needs the number that moved and the action it implies, not a scoreboard.",
      jtbd: "Show me the single most important thing to act on this week.",
      rootCause: "ux",
      effort: "M",
      firstAction: "Add a 'Fix first' hero to Home that ranks the top 3 actions by score impact.",
      severity: 4,
    },
  },
  {
    key: "human-riche-home-no-workflow",
    finding: {
      persona: "ciso",
      kind: "dislike",
      verdict: "fix",
      title: "Home sends me into listing pages instead of a workflow",
      customerPain:
        "Every Home tile links into a long listing page; I assemble the action plan, the rules, and the follow-ups myself. There's no workflow carrying me from 'here's an issue' to 'here's it assigned and tracked.'",
      detail:
        "The product stops at surfacing data and leaves orchestration to the user. Action plans and recommended rules even live in different sections — recommended rules sit under My Organization, not on the External Attack Surface page — so I aggregate by hand.",
      jtbd: "Turn findings into an assigned, tracked plan without me stitching screens together.",
      rootCause: "workflow",
      effort: "L",
      firstAction:
        "Prototype a Home action plan that converts the top findings into an assignable, trackable worklist.",
      severity: 4,
    },
  },
  {
    key: "human-riche-ia-click-depth",
    finding: {
      persona: "vrm",
      kind: "dislike",
      verdict: "fix",
      title: "It takes five or six clicks to reach a single recommendation",
      customerPain:
        "Reaching an actual recommendation means drilling Issues by breach risk → Medium risk → PPTP Service Accessible → Findings + Recommendations. Five or six clicks of lists-into-lists before I can do anything.",
      detail:
        "The IA nests lists inside lists with no shortcut to the recommendation. For a vendor-risk manager triaging dozens of vendors, that click depth is the difference between working the whole portfolio and working a handful.",
      jtbd: "Get me from a risk signal to the fix in one or two clicks.",
      rootCause: "ux",
      effort: "M",
      firstAction:
        "Surface the recommendation and remediation inline on the issue row so the drill-down is optional.",
      severity: 3,
    },
  },
  {
    key: "human-riche-top5-cta",
    finding: {
      persona: "ciso",
      kind: "dislike",
      verdict: "fix",
      title: "The 'resolve the top 5' CTA points at three different lists",
      customerPain:
        "The CTA promises 'resolving the top 5 would increase this company's score by 11.0,' but links out to three separate lists. Top 5 of what, across which list? I can't tell what to actually do.",
      detail:
        "A high-value, score-moving call to action dead-ends into ambiguity. The promise (a concrete point gain) is exactly right; the execution splits the '5' across lists so the user can't act on it confidently.",
      jtbd: "Let me act on the single highest-impact set of fixes with confidence.",
      rootCause: "ux",
      effort: "S",
      firstAction:
        "Make the CTA open one ranked, cross-list 'top 5 by score impact' view with the fixes inline.",
      severity: 3,
    },
  },
  {
    key: "human-riche-history-board",
    finding: {
      persona: "vrm",
      kind: "dislike",
      verdict: "fix",
      title: "History repeats events daily with no way to work them",
      customerPain:
        "The History page repeats the same events day over day with no indicator of what's overdue versus net-new, and no way to work an item. It reads like a log when it should be a board I can manage.",
      detail:
        "There's no state (new / in progress / overdue / resolved) and no ownership, so History is a feed to read rather than a queue to clear. For issue management this should be a Kanban the team works, not a chronological dump.",
      jtbd: "Manage issues to closure, not just watch them scroll by.",
      rootCause: "workflow",
      effort: "L",
      firstAction:
        "Pilot a Kanban over the issue feed with new / in-progress / overdue / resolved states and owners.",
      severity: 3,
    },
  },
  {
    key: "human-riche-vendor-detection",
    finding: {
      persona: "vrm",
      kind: "dislike",
      verdict: "kill",
      title: "Vendor Detection is a setup task disguised as a report",
      customerPain:
        "Vendor Detection asks me to 'confirm this new vendor we discovered' — a configuration action — but it lives inside the reporting section, and it's never clear why the data matters or what decision it drives.",
      detail:
        "Two different jobs (configure my vendor list vs. read risk reporting) are conflated on one screen, so it serves neither well. The confirm-vendor action belongs in onboarding/config; as a standalone report it earns its place only if it drives a risk decision.",
      jtbd: "Keep my vendor list accurate without wading through a reporting screen to do it.",
      rootCause: "workflow",
      effort: "M",
      firstAction:
        "Move vendor confirmation into onboarding/config; retire the standalone Vendor Detection report unless it drives a specific decision.",
      severity: 3,
    },
  },
  {
    key: "human-riche-company-profile",
    finding: {
      persona: "gtm_cs",
      kind: "dislike",
      verdict: "fix",
      title: "Company Profile and 'Launch a Trust Center' collide on one page",
      customerPain:
        "The company profile page also hosts the 'Launch a Trust Center' CTA — two very different jobs. And it's never clear why a company would share its data at all; the only obvious payoff is a more accurate score, which doesn't feel worth it.",
      detail:
        "Mixing 'describe my company' with 'publish a Trust Center' muddies both, and the value exchange for sharing data is unstated. Customers need a reason: faster deals, fewer inbound questionnaires, a shareable trust artifact — not just reputational nicety.",
      jtbd: "Understand what I get for sharing my data before I invest effort in it.",
      rootCause: "packaging",
      effort: "M",
      firstAction:
        "Split profile from Trust Center and state the value exchange (faster deals, fewer questionnaires) at the point of the ask.",
      severity: 3,
    },
  },
  {
    key: "human-riche-risk-quant",
    finding: {
      persona: "ciso",
      kind: "dislike",
      verdict: "double_down",
      title: "Risk quantification is buried, and I question the numbers",
      customerPain:
        "Risk quantification gives weight to the score and every other metric, so it should be front and center — but it's buried a few clicks in, and when I found it I caught myself asking how real these dollar figures actually are.",
      detail:
        "The single most board-relevant output (risk in dollars) is under-surfaced and under-explained. The opportunity is to make it the headline AND show the methodology and confidence, so a CISO can defend the number in front of the board.",
      jtbd: "Give me a defensible dollar figure for risk that I can take to the board.",
      rootCause: "strategy",
      effort: "M",
      firstAction:
        "Promote risk-in-dollars to the top of Home and expose the methodology and confidence behind it.",
      severity: 4,
    },
  },
];

async function latestRunId(db: Awaited<ReturnType<typeof getDb>>): Promise<string | null> {
  const [row] = await db
    .select({ id: runs.id })
    .from(runs)
    .where(eq(runs.status, "completed"))
    .orderBy(desc(runs.startedAt))
    .limit(1);
  return row?.id ?? null;
}

async function main(): Promise<void> {
  // Validate every finding up front (schema-gate before any DB write).
  const validated = ENTRIES.map((e) => ({ ...e, finding: CreateHumanFindingSchema.parse(e.finding) }));
  const spread = validated.reduce<Record<string, number>>((acc, e) => {
    const v = e.finding.verdict ?? "—";
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});

  if (hasFlag("--validate-only")) {
    console.log(
      `VALID: ${validated.length} human findings — ` +
        Object.entries(spread)
          .map(([k, n]) => `${n} ${k}`)
          .join(", "),
    );
    for (const e of validated) {
      console.log(`  [${e.finding.verdict ?? "—"}] (${e.finding.persona}) ${e.finding.title}`);
    }
    return;
  }

  const db = await getDb();
  const runId = getArg("--run") ?? (await latestRunId(db));
  if (!runId) throw new Error("no completed run found — pass --run <uuid> or publish a run first");

  const rows = validated.map((e) => {
    const f = e.finding;
    const isDislike = f.kind === "dislike";
    return {
      runId,
      persona: f.persona,
      key: e.key,
      kind: f.kind,
      title: f.title,
      detail: f.detail,
      customerPain: isDislike ? f.customerPain ?? null : null,
      jtbd: f.jtbd,
      rootCause: isDislike ? f.rootCause ?? null : null,
      effort: isDislike ? f.effort ?? null : null,
      firstAction: isDislike ? f.firstAction ?? null : null,
      severity: isDislike ? f.severity ?? null : null,
      verdict: f.verdict ?? (f.kind === "like" ? "double_down" : null),
      origin: "human",
      screenshotIds: [] as string[],
      // whyItWorks powers the like's collapsed quote (raw.whyItWorks ?? detail).
      raw: e.whyItWorks ? { ...f, whyItWorks: e.whyItWorks } : f,
    };
  });

  const inserted = await db
    .insert(findings)
    .values(rows)
    .onConflictDoNothing({ target: [findings.runId, findings.persona, findings.key] })
    .returning({ id: findings.id });

  console.log(
    `seeded ${inserted.length} human findings into run ${runId} ` +
      `(${rows.length - inserted.length} already present, skipped)`,
  );
}

runMain(main);
