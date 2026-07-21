/**
 * Seeds the SSC-ProductOS Linear project with the internal work — the os-build
 * backfill (Done issues for the engine already shipped) and the 30-day role
 * operating plan (spec Appendix B, verbatim intent) — with phase labels and
 * weekday due dates computed from config/linear.json `day0`.
 *
 *   node bin/run.mjs npx tsx runner/seed-linear.ts --validate-only
 *     Validate the seed set + print the plan (what it WOULD create). No key needed.
 *
 *   node bin/run.mjs npx tsx runner/seed-linear.ts
 *     Create the issues in the project (idempotent — skips a title already present).
 *
 * This is exempt from the approval gate (it's internal build + role work, not
 * matrix-derived product tickets). Requires LINEAR_API_KEY only to actually push.
 */
import { loadEnv } from "./lib/env";
import { hasFlag as hasFlagOf } from "./lib/args";
import { getLinearConfig, getLinearClient, isLinearConfigured, labelId, stateId } from "../lib/linear";
import { SeedTicketsFileSchema, type SeedTicket } from "../lib/schemas/ticket";
import { runMain } from "./lib/zod";

loadEnv();
const ARGV = process.argv.slice(2);
const hasFlag = (f: string) => hasFlagOf(ARGV, f);

const OS_BUILD: SeedTicket[] = [
  {
    key: "osbuild-persona-engine",
    title: "Persona evaluation engine (CISO / VRM / GTM agents + corpus)",
    description:
      "Three persona subagents drive the live SecurityScorecard platform via a persistent-Chromium runner, grounded in a researched persona corpus, and emit schema-valid findings. Shipped.",
    labels: ["track:internal", "origin:os-build"],
    priority: 2,
    state: "Done",
    subIssues: [],
  },
  {
    key: "osbuild-synth-judge",
    title: "Synthesizer + LLM-as-judge scoring",
    description:
      "Synthesizes the three persona evaluations into the Prompt-1 deliverable (3 likes / 5 dislikes / Kill-Fix-Double-Down) and scores every finding for specificity + actionability. Shipped.",
    labels: ["track:internal", "origin:os-build"],
    priority: 2,
    state: "Done",
    subIssues: [],
  },
  {
    key: "osbuild-schema-gate",
    title: "Schema-gate publish pipeline (zod + validate-only)",
    description:
      "Every agent output passes a zod contract with min-length/enum guards; --validate-only rejects vague output before it persists. Idempotent publish to Postgres + Langfuse. Shipped.",
    labels: ["track:internal", "origin:os-build"],
    priority: 3,
    state: "Done",
    subIssues: [],
  },
  {
    key: "osbuild-admin-console",
    title: "Admin console + run queue loop + auth",
    description:
      "Email+password admin login, the Planning dashboard, the run-request queue with FIFO claim, and the run-detail view. Shipped.",
    labels: ["track:internal", "origin:os-build"],
    priority: 3,
    state: "Done",
    subIssues: [],
  },
  {
    key: "osbuild-feedback-ingestion",
    title: "Customer feedback ingestion + Planning panel (Phase 1)",
    description:
      "feedback_items table, a read-only throttled review scraper, an idempotent publish path, and the Planning ingestion panel (connected vs available sources, persona knowledge bases, theme proposals). Shipped.",
    labels: ["track:internal", "origin:os-build"],
    priority: 3,
    state: "Done",
    subIssues: [],
  },
  {
    key: "osbuild-reviewer-gate",
    title: "Reviewer layer + human approval gate (Phase 2)",
    description:
      "Human up/down votes + comments on findings, add-human-finding, the AI accuracy strip, and the approval gate that is the sole trigger for the Linear push. Shipped.",
    labels: ["track:internal", "origin:os-build"],
    priority: 3,
    state: "Done",
    subIssues: [],
  },
];

/** Role-plan (Appendix B). dueDayOffset is days from day-0; adjusted to a weekday. */
const ROLE_PLAN: SeedTicket[] = [
  {
    key: "roleplan-1-1s",
    title: "Run 1:1s across the product org",
    description:
      "Standard question set for each: what's working, what's slow, where decisions stall, what you'd kill.",
    labels: ["track:internal", "origin:role-plan", "phase:48h"],
    priority: 1,
    state: "Todo",
    dueDayOffset: 2,
    subIssues: [
      "1:1s with all PMs",
      "1:1 with PM leadership",
      "1:1 with design leadership",
      "1:1 with engineering leadership",
      "1:1s with GTM leadership + adjacent execs (CS, finance)",
    ],
  },
  {
    key: "roleplan-systems-audit",
    title: "Systems and process deep dive",
    description:
      "Audit what PMs actually use day to day: Jira PRODF configuration + hygiene, CCB minutes, Pendo/Sigma/Span dashboards, the weekly reporting stack, and the existing Claude skills library (what exists, what's used, what's tribal).",
    labels: ["track:internal", "origin:role-plan", "phase:48h"],
    priority: 1,
    state: "Todo",
    dueDayOffset: 2,
    subIssues: [],
  },
  {
    key: "roleplan-week1-assessment",
    title: "Week-1 assessment to Sam",
    description:
      "First-week readout: state of the product org, processes, and systems; what's strong, what's broken, what I'd change first. Evidence from the 1:1s and the systems audit.",
    labels: ["track:internal", "origin:role-plan", "phase:week-1"],
    priority: 1,
    state: "Todo",
    dueDayOffset: 5,
    subIssues: [],
  },
  {
    key: "roleplan-prodops-design",
    title: "Product Ops org design recommendation",
    description:
      "Deliver to Sam: what the product ops team looks like, roles needed, structure for success, hiring sequence. Contents come from the week-1 findings.",
    labels: ["track:internal", "origin:role-plan", "phase:week-1"],
    priority: 1,
    state: "Todo",
    dueDayOffset: 5,
    subIssues: [],
  },
  {
    key: "roleplan-pm-assessment",
    title: "Stand up the PM assessment system",
    description:
      "**Dimensions and signals.** AI adoption: share of specs/prototypes produced with AI assistance, workflow-library usage, contributions back to the library. Customer obsession: customer calls attended monthly, customer verbatims cited in specs, engagement with Pendo Listen themes, whether meetings start with customer stories. Speed: pod cycle time, decision latency (age of open questions), five-day-mantra adherence, R/Y/G slip rate.\n\n" +
      "**Warning signs.** Specs with no customer evidence; AI usage flat after enablement; chronic yellow milestones; surprises surfacing first at CCB; blame-forward updates.\n\n" +
      "**Cadence.** Baseline in week 2 from 1:1s plus artifact review (each PM's last 3 specs and last 3 launches); scored monthly on a simple rubric; reviewed with Sam.\n\n" +
      "**Coaching plan trigger.** A dimension scoring low twice consecutively triggers a documented 30-day coaching plan: named behaviors, paired AI workflows, weekly 15-minute check.\n\n" +
      "**Escalation.** Two coaching cycles without movement, or a trust/values breach, or repeated customer-impact misses → recommend a role or people change to Sam, with the evidence trail.",
    labels: ["track:internal", "origin:role-plan", "phase:week-2"],
    priority: 2,
    state: "Todo",
    dueDayOffset: 12,
    subIssues: [
      "Baseline every PM from 1:1s + last 3 specs / 3 launches",
      "Define the monthly rubric and score",
      "Wire the coaching-plan trigger + escalation path",
    ],
  },
  {
    key: "roleplan-metrics-v1",
    title: "Metrics source of truth v1 live",
    description:
      "First version of the weekly KPI dashboard populated (this app's Metrics tab standing in), owners assigned per metric.",
    labels: ["track:internal", "origin:role-plan", "phase:week-2"],
    priority: 2,
    state: "Todo",
    dueDayOffset: 12,
    subIssues: [],
  },
  {
    key: "roleplan-ai-workflows",
    title: "AI workflows 2 through 5 stood up",
    description:
      "Stand up the remaining reusable AI workflows — competitive & market intelligence, product planning → prototype, automated prototype testing, and business-case / investment memo — each live with a named human reviewer and a success metric.",
    labels: ["track:internal", "origin:role-plan", "phase:week-3"],
    priority: 2,
    state: "Todo",
    dueDayOffset: 19,
    subIssues: [],
  },
  {
    key: "roleplan-day30-check",
    title: "Day-30 systems check",
    description:
      "Dashboards live, Friday cadence running twice consecutively, PM assessment baseline complete for every PM, accountability mechanisms documented, escalation paths exercised at least once (in the wild or by drill).",
    labels: ["track:internal", "origin:role-plan", "phase:day-30"],
    priority: 2,
    state: "Todo",
    dueDayOffset: 30,
    subIssues: [],
  },
];

/**
 * The 5 reusable Claude/AI workflows to stand up in the first 90 days
 * (take-home Prompt 4), authored to Riché's specific product-operating
 * workflows. Live in Linear as TRZ-1913..1917; kept here so a fresh workspace
 * reseed recreates them (idempotent by title). track:internal + origin:role-plan
 * so they render on the ProductOS timeline/kanban; near-term due dates spread
 * them across today → this-month on the relative-time timeline.
 */
const AI_WORKFLOWS: SeedTicket[] = [
  {
    key: "aiwf-engagement-synthesis",
    title: "AI workflow 1/5: Daily customer-engagement synthesis + weekly roll-up",
    description:
      "Daily AI synthesis of how customers are actually engaging with the product, rolled up weekly into an updated view of who our customers are and what to build next. Human-in-the-loop: the model synthesizes and drafts; a named PM validates the weekly roll-up before personas/JTBD or action items change.\n\n" +
      "**Inputs**\n- Product analytics (Pendo/Heap): usage, funnels, feature adoption.\n- Session replay data (e.g. FullStory/LogRocket) for behavioral signal.\n- Recent customer feedback (Pendo Listen, support, reviews).\n- Bug tickets reported in the window (Jira PRODF / support).\n- Notes and transcripts from customer success manager calls.\n\n" +
      "**Steps — daily**\n1. Pull the day's product analytics, session replays, customer feedback, reported bugs, and CSM call notes.\n2. Synthesize each source into an individual daily report: what changed, notable sessions, emerging complaints, new bugs.\n\n" +
      "**Steps — weekly roll-up**\n3. Aggregate the week's daily reports and analyze engagement against the trailing three months.\n4. Flag where behavior is lagging or trending down versus that baseline.\n5. Output updated persona and jobs-to-be-done statements reflecting what the data now shows.\n6. Draft action items the team could focus on in the next one to two weeks to improve the product where we see lagging behavior.\n\n" +
      "**Outputs**\n- Individual daily engagement reports.\n- A weekly roll-up: engagement vs. trailing-3-months, updated personas + JTBD, and 1–2 week action items.\n\n" +
      "**Human review**\n- The owning PM validates the weekly roll-up and approves persona/JTBD updates and action items before they're adopted.\n\n" +
      "**Automation plan**\n- Scheduled daily run produces the individual reports; a Friday roll-up posts to Slack #product for PM sign-off.\n\n" +
      "**Success metric**\n- Source coverage (all inputs synthesized daily); action items shipped per cycle; engagement recovery on flagged areas vs. the 3-month baseline.",
    labels: ["track:internal", "origin:role-plan", "phase:48h"],
    priority: 2,
    state: "Todo",
    dueDayOffset: 1,
    subIssues: [],
  },
  {
    key: "aiwf-competitive-intel",
    title: "AI workflow 2/5: Competitive & market intelligence",
    description:
      "A recurring competitive- and market-intelligence workflow that watches the market and our competitors and turns it into product recommendations. Weekly report, monthly synthesis.\n\n" +
      "**Inputs**\n- News sources and press covering competitors and the category.\n- Competitor websites (product, pricing, changelog / release pages).\n- Competitive-intelligence tools (e.g. Klue / Crayon).\n- Review sites (G2, Capterra, TrustRadius) — reviews of our competitors.\n\n" +
      "**Steps**\n1. Ingest data from news sources, competitor websites, and competitive-intelligence tools for the window.\n2. Pull and analyze reviews of our competitors from the review sites — what customers praise and complain about.\n3. Identify the latest developments related to each competitor's business and their products (launches, pricing moves, positioning shifts).\n4. Compare against our roadmap and positioning to surface gaps and opportunities.\n\n" +
      "**Outputs**\n- A weekly competitive-intelligence report: what changed this week and why it matters.\n- A monthly synthesis of the data with recommendations on what we could be doing to improve the product and be more competitive in the market.\n\n" +
      "**Human review**\n- Product + PMM review the recommendations before any feed the roadmap or messaging.\n\n" +
      "**Automation plan**\n- Weekly scheduled run posts the report to Slack #product; a monthly run produces the synthesis + recommendations.\n\n" +
      "**Success metric**\n- Competitive gaps closed per quarter; win/loss shifts on named competitors; roadmap items traceable to a market signal.",
    labels: ["track:internal", "origin:role-plan", "phase:48h"],
    priority: 2,
    state: "Todo",
    dueDayOffset: 3,
    subIssues: [],
  },
  {
    key: "aiwf-product-planning",
    title: "AI workflow 3/5: Product planning → prototype",
    description:
      "A product-planning workflow that turns PM inputs into a defined concept, then hands epics to AI agents that build and stage an initial prototype. The goal: a PM reads one of our generated reports, hands Claude Code (or Slack) the problem and their hypothesized solution, and comes back to a working prototype ready to test.\n\n" +
      "**Inputs**\n- PM inputs such as the competitive-analysis / intelligence report and the customer-engagement report's recommendations.\n- The PM's own problem statement and hypothesis for the solution.\n- Current roadmap + open epics, to align and avoid duplication.\n\n" +
      "**Steps**\n1. Take the defined problem and the hypothesis for the solution.\n2. Run it through a planning workflow to develop a high-level concept.\n3. Output epics to a board.\n4. Once the epics are created, AI agents pick them up and build an initial prototype.\n5. Stage the prototype somewhere the PM can reach it.\n\n" +
      "**Example flow**\n- A PM reads one of the reports we generate for them, shares it with Claude Code or Slack, and says: \"I'd like you to create a prototype — this is the problem I see, and this is the solution I think will help address it.\" The agents build a fully functioning prototype the PM can test by the time they get back to their desk.\n\n" +
      "**Outputs**\n- A high-level concept doc (problem, hypothesis, approach).\n- Epics on the board.\n- A staged, testable prototype.\n\n" +
      "**Human review**\n- The PM reviews the concept and epics and decides whether the staged prototype is worth testing further.\n\n" +
      "**Automation plan**\n- Triggered on demand from Claude Code / Slack; agents run the plan → epics → build → stage pipeline and report back with the prototype link.\n\n" +
      "**Success metric**\n- Time from problem statement to a testable prototype; share of prototypes that advance to user testing.",
    labels: ["track:internal", "origin:role-plan", "phase:week-1"],
    priority: 2,
    state: "Todo",
    dueDayOffset: 7,
    subIssues: [],
  },
  {
    key: "aiwf-prototype-testing",
    title: "AI workflow 4/5: Automated prototype testing",
    description:
      "Once a prototype is prepared, automatically get it in front of testers, collect and synthesize the feedback, and iterate the prototype until it satisfies the panel.\n\n" +
      "**Inputs**\n- A staged prototype (from the product-planning workflow).\n- A target test audience: a user-testing service, or a subset of our customer advisory board.\n- A definition of \"satisfactory\" — the success criteria for the panel.\n\n" +
      "**Steps**\n1. Deploy the prototype to a user-testing service or to the chosen subset of our customer advisory board.\n2. Collect the feedback data from the panel.\n3. Synthesize the results — what worked, what didn't, where testers got stuck.\n4. Automatically optimize / improve the prototype given the feedback.\n5. Repeat the deploy → collect → synthesize → improve loop until we reach a version that is satisfactory to our customers or to the panel of people we are testing against.\n\n" +
      "**Outputs**\n- Synthesized test-result reports per round.\n- An improved prototype that meets the panel's bar.\n\n" +
      "**Human review**\n- The PM sets the success bar and confirms when a version is satisfactory (or calls it off).\n\n" +
      "**Automation plan**\n- Runs the test-and-optimize loop on each prototype; each round posts a synthesis + the updated build for review.\n\n" +
      "**Success metric**\n- Rounds to satisfactory; panel satisfaction score; prototype iteration cycle time.",
    labels: ["track:internal", "origin:role-plan", "phase:week-2"],
    priority: 2,
    state: "Todo",
    dueDayOffset: 14,
    subIssues: [],
  },
  {
    key: "aiwf-business-case",
    title: "AI workflow 5/5: Business-case / investment memo",
    description:
      "Once we have data from the tested prototype, build an investment memo that makes the business case for productionizing the feature — solid enough for a PM to take to leadership.\n\n" +
      "**Inputs**\n- Prototype test data (from the automated prototype-testing workflow): user feedback + results.\n- Revenue data — potential / associated revenue, pipeline, expansion.\n- Other engagement metrics relevant to the feature.\n\n" +
      "**Steps**\n1. Pull the prototype's user-test feedback and results.\n2. Pull the revenue data and the related engagement metrics.\n3. Build an investment memo: the problem, the validated solution, the expected impact, and the ask.\n4. Make the business case for building out and productionizing this area of the product.\n\n" +
      "**Outputs**\n- An investment memo a product manager can take to leadership, if needed, to justify the investment in this area of the product.\n\n" +
      "**Human review**\n- The PM reviews and owns the memo before it goes to leadership.\n\n" +
      "**Automation plan**\n- Triggered once prototype testing reaches a satisfactory version; drafts the memo from the test + revenue + engagement data for PM review.\n\n" +
      "**Success metric**\n- Memo turnaround time; investment decisions supported; win rate of memos taken to leadership.",
    labels: ["track:internal", "origin:role-plan", "phase:week-3"],
    priority: 2,
    state: "Todo",
    dueDayOffset: 25,
    subIssues: [],
  },
];

/** day0 + offset days, nudged forward off weekends → ISO date (YYYY-MM-DD). */
function dueDate(day0: string, offset: number): string {
  const d = new Date(`${day0}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  const dow = d.getUTCDay();
  if (dow === 6) d.setUTCDate(d.getUTCDate() + 2); // Sat → Mon
  else if (dow === 0) d.setUTCDate(d.getUTCDate() + 1); // Sun → Mon
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const file = SeedTicketsFileSchema.parse({
    osBuild: OS_BUILD,
    rolePlan: [...ROLE_PLAN, ...AI_WORKFLOWS],
  });
  const cfg = getLinearConfig();
  const all = [...file.osBuild, ...file.rolePlan];

  if (hasFlag("--validate-only") || !isLinearConfigured()) {
    console.log(
      `VALID: ${file.osBuild.length} os-build + ${file.rolePlan.length} role-plan tickets (day0 ${cfg.day0})`,
    );
    for (const t of all) {
      const due = t.dueDayOffset != null ? ` due ${dueDate(cfg.day0, t.dueDayOffset)}` : "";
      console.log(`  [${t.state}] ${t.title} — ${t.labels.join(", ")}${due} (${t.subIssues.length} sub)`);
    }
    if (!isLinearConfigured()) {
      console.log("\nLINEAR_API_KEY not set — nothing created. Set it to seed the board.");
    }
    return;
  }

  const client = getLinearClient();
  const project = await client.project(cfg.project.id);

  // Idempotent dedup keyed by title → issue id (not just a title Set), and
  // paginated through the FULL project (Linear caps a page at 250) — needed so
  // an already-existing PARENT's id can be reused to attach any still-missing
  // sub-issues under it, rather than only deduping at the parent level.
  const existingByTitle = new Map<string, string>();
  let after: string | undefined;
  for (;;) {
    const page = await project.issues({ first: 250, after });
    for (const i of page.nodes) existingByTitle.set(i.title, i.id);
    if (!page.pageInfo.hasNextPage) break;
    after = page.pageInfo.endCursor ?? undefined;
    if (!after) break;
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;
  for (const t of all) {
    try {
      let parentId = existingByTitle.get(t.title);
      if (parentId) {
        skipped += 1;
      } else {
        const payload = await client.createIssue({
          teamId: cfg.team.id,
          projectId: cfg.project.id,
          title: t.title,
          description: t.description,
          priority: t.priority,
          stateId: stateId(t.state),
          labelIds: t.labels.map((l) => labelId(l)),
          dueDate: t.dueDayOffset != null ? dueDate(cfg.day0, t.dueDayOffset) : undefined,
        });
        const parent = await payload.issue;
        if (!parent) throw new Error(`createIssue returned no issue for "${t.title}"`);
        parentId = parent.id;
        existingByTitle.set(t.title, parentId);
        created += 1;
      }

      // Sub-issues are deduped individually (by title) so a prior partial run
      // that created the parent but died partway through its sub-issues can be
      // re-run and only creates what's still missing — never re-skips the whole
      // ticket just because its parent title now exists.
      for (const sub of t.subIssues) {
        if (existingByTitle.has(sub)) {
          skipped += 1;
          continue;
        }
        try {
          const subPayload = await client.createIssue({
            teamId: cfg.team.id,
            projectId: cfg.project.id,
            title: sub,
            priority: t.priority,
            stateId: stateId(t.state),
            labelIds: t.labels.map((l) => labelId(l)),
            parentId,
          });
          await subPayload.issue;
          existingByTitle.set(sub, sub); // value unused for sub-issues; presence is what matters
          created += 1;
        } catch (e) {
          failed += 1;
          console.error(`failed to create sub-issue "${sub}": ${e instanceof Error ? e.message : e}`);
        }
      }
    } catch (e) {
      failed += 1;
      console.error(`failed to create "${t.title}": ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(
    `seeded Linear: ${created} issues created, ${skipped} already present, ${failed} failed (re-run to retry failures)`,
  );
}

runMain(main);
