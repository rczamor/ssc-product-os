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
      "Feedback-to-theme clustering, matrix-to-Linear drafting, Friday Update generation, rhythm-drift/shipped-not-adopted detection — each live with a named human reviewer and a success metric.",
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
 * (take-home Prompt 4). Live in Linear as TRZ-1913..1917; kept here so a fresh
 * workspace reseed recreates them (idempotent by title). track:internal +
 * origin:role-plan so they render on the ProductOS timeline/kanban.
 */
const AI_WORKFLOWS: SeedTicket[] = [
  {
    key: "aiwf-transcript-themes",
    title: "AI workflow 1/5: Transcript → roadmap themes",
    description:
      'Reusable Claude/AI workflow to stand up in the first 90 days (take-home Prompt 4 — "transcript-to-roadmap themes"). Human-in-the-loop by design: the model drafts, a named PM approves before anything reaches the roadmap.\n\n' +
      "**Inputs**\n- Gong/Zoom call transcripts (discovery, CS, renewal) from the Snowflake customer-insights layer.\n- The persona / maturity framework for persona-matching.\n- Current roadmap + open Jira (PRODF) epics, to avoid re-proposing known work.\n\n" +
      "**Steps**\n1. Pull the week's transcripts; strip PII.\n2. Extract pains, requests, and verbatims; tag with account, ARR band, persona.\n3. Cluster into themes; dedupe against last week + existing roadmap items.\n4. Rank by frequency × ARR weight × strategic fit; attach 2–3 verbatims each.\n5. Draft candidate roadmap cards (problem, evidence, personas).\n\n" +
      "**Outputs**\n- A weekly Voice-of-Customer themes brief with linked verbatims.\n- Candidate roadmap cards drafted as proposals (never auto-committed).\n\n" +
      "**Human review**\n- The owning PM validates each theme against the calls and accepts / merges / rejects before it becomes a candidate.\n\n" +
      "**Automation plan**\n- Scheduled Friday run; posts to Slack #product and drafts proposal cards; a human promotes to the roadmap.\n\n" +
      "**Success metric**\n- % of roadmap items traceable to a customer verbatim (≥80%); theme → spec cycle time.",
    labels: ["track:internal", "origin:role-plan", "phase:week-2"],
    priority: 2,
    state: "Todo",
    dueDayOffset: 12,
    subIssues: [],
  },
  {
    key: "aiwf-feedback-matching",
    title: "AI workflow 2/5: Feedback → Jira/matrix matching",
    description:
      'Reusable Claude/AI workflow to stand up in the first 90 days (take-home Prompt 4 — "feedback-to-Jira matching"). This app already models the pattern end-to-end (matrix → drafted tickets → human approval → Linear push); this generalizes it to the live Pendo/support stream.\n\n' +
      "**Inputs**\n- Pendo Listen feedback, support tickets, the persona-review matrix findings.\n- The existing Jira (PRODF) issue corpus + labels.\n\n" +
      "**Steps**\n1. Normalize + dedupe incoming feedback (content hash).\n2. Embed + match against existing Jira issues; classify duplicate-of / relates-to / net-new.\n3. Attach verbatim + running count + persona to the matched issue.\n4. For net-new, draft a ticket (problem, evidence, proposed priority) as a proposal.\n\n" +
      "**Outputs**\n- Every feedback item linked to a tracked issue or a drafted new one, with evidence + confidence.\n\n" +
      "**Human review**\n- A PM confirms the match or creates the ticket — the same hard approval gate this app enforces for the matrix push.\n\n" +
      "**Automation plan**\n- Runs on each feedback batch; writes proposals only; approved proposals push idempotently.\n\n" +
      "**Success metric**\n- Feedback triage time (<1 business day); % linked within a week; match precision vs human accept-rate.",
    labels: ["track:internal", "origin:role-plan", "phase:week-2"],
    priority: 2,
    state: "Todo",
    dueDayOffset: 12,
    subIssues: [],
  },
  {
    key: "aiwf-release-notes",
    title: "AI workflow 3/5: Release notes from Jira + GitHub",
    description:
      'Reusable Claude/AI workflow to stand up in the first 90 days (take-home Prompt 4 — "release notes from Jira/GitHub"). Closes the loop between shipping and telling customers, with ROI framing.\n\n' +
      "**Inputs**\n- Jira (PRODF) issues moved to Done in the window.\n- Merged GitHub PRs (titles, linked issues, labels).\n- Adoption metrics per feature (Pendo/Heap) for framing.\n\n" +
      "**Steps**\n1. Collect completed work; join Jira issues to their PRs.\n2. Group by feature / persona; drop internal-only churn.\n3. Draft a customer-facing note (benefit + ROI) and an internal changelog (what/why/risk).\n4. Link each note to the adoption metric it should move.\n\n" +
      "**Outputs**\n- Customer-facing release notes + internal changelog, posted to Slack / Confluence.\n\n" +
      "**Human review**\n- PM/PMM edits tone and customer framing before publish.\n\n" +
      "**Automation plan**\n- Runs weekly and on Thursday release-train sign-off; drafts both for one-click publish.\n\n" +
      "**Success metric**\n- Release-note lead time (sign-off → published, same day); adoption lift on noted features.",
    labels: ["track:internal", "origin:role-plan", "phase:week-3"],
    priority: 3,
    state: "Todo",
    dueDayOffset: 19,
    subIssues: [],
  },
  {
    key: "aiwf-low-adoption",
    title: "AI workflow 4/5: Low-adoption / high-effort feature detection",
    description:
      'Reusable Claude/AI workflow to stand up in the first 90 days (take-home Prompt 4 — "low-adoption/high-effort feature detection"). The Measure tab already trips these triggers; this packages detection + routing into a repeatable CCB input.\n\n' +
      "**Inputs**\n- Pendo/Heap adoption + the metrics registry (Feature Adoption, Activation D7/D30/D90, Friction Index).\n- Engineering effort signals (Span/DORA, story points, maintenance load).\n- The feature taxonomy (rhythm class + value role).\n\n" +
      "**Steps**\n1. Compute adoption vs. effort per feature against each feature's rhythm-class baseline.\n2. Flag shipped-not-adopted (<25% D30), legacy (<2%, no tier-1 dependency), high-effort/low-adoption.\n3. Draft a CCB decision packet per flagged feature with a recommended Kill / Fix / Double-Down + evidence.\n\n" +
      "**Outputs**\n- The Measure tab's Action Queue + a per-feature CCB decision packet.\n\n" +
      "**Human review**\n- The CCB makes the kill/invest call; the PM commits the first action. The workflow never kills on its own.\n\n" +
      "**Automation plan**\n- Runs weekly; auto-drafts the CCB decision issue and routes it to the Thursday agenda.\n\n" +
      "**Success metric**\n- Count of forced kill/invest decisions per quarter; engineering effort reclaimed.",
    labels: ["track:internal", "origin:role-plan", "phase:week-3"],
    priority: 2,
    state: "Todo",
    dueDayOffset: 19,
    subIssues: [],
  },
  {
    key: "aiwf-ccb-recap",
    title: "AI workflow 5/5: Weekly CCB recap",
    description:
      'Reusable Claude/AI workflow to stand up in the first 90 days (take-home Prompt 4 — "weekly CCB recap"). Turns the Change Control Board into a written, traceable record the same day it meets.\n\n' +
      "**Inputs**\n- CCB meeting notes / decision log.\n- Jira (PRODF) scope changes and release sign-offs from the session.\n- The week's R/Y/G roll-up.\n\n" +
      "**Steps**\n1. Summarize decisions: approved, deferred, killed — with rationale.\n2. Link every decision to affected tickets, owners, due dates.\n3. Draft the recap and the ticket-state updates the decisions imply.\n\n" +
      "**Outputs**\n- A CCB recap posted to Slack / Confluence + a proposed set of ticket updates.\n\n" +
      "**Human review**\n- Product Ops verifies decisions and owners before the recap posts and before any ticket changes.\n\n" +
      "**Automation plan**\n- Runs right after the Thursday CCB; posts the recap and stages ticket updates for one-click confirmation.\n\n" +
      "**Success metric**\n- Recap same-day rate (100%); decision → action latency (owner + first action within 24h).",
    labels: ["track:internal", "origin:role-plan", "phase:day-30"],
    priority: 3,
    state: "Todo",
    dueDayOffset: 30,
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
