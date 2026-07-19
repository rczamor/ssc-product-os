# SSC Product OS: Build and Run Plan

Handoff document for Claude Code, working in `rczamor/ssc-product-os`. Execute phases in order. Phase 1 must complete before anything else ships. Riché reviews at each gate marked **[GATE]**.

---

## 1. What you are building

This repo answers a five-part take-home for SecurityScorecard's Head of Product Operations & AI Innovations role. The five prompts are being answered as one working system, not five documents. The app has three screens:

1. **Planning** (exists, extend): persona evaluation runs, ingested customer feedback, the evaluation matrix (3 likes / 5 dislikes / Kill-Fix-Double-Down), human + agent review, and an approval gate.
2. **Work** (new): real Linear tickets from the approved matrix plus the 30-day operating plan, rendered as Kanban and timeline with an internal/external toggle, plus an auto-generated Friday Product & Engineering Update.
3. **Metrics** (new): the weekly Product KPI operating system: 14 metrics with full metadata, a feature taxonomy, and a generated sample dataset that visibly trips action triggers.

The evaluation engine (personas, journeys, synthesizer, judge, schema gates, admin console, queue loop, Langfuse tracing) is already built. Nothing has run end to end yet. That is step one.

## 2. Ground rules

- **Read-only conduct in the SSC product.** Never send vendor requests or invites, never modify rules or portfolios, cancel out of any flow that emails a third party. Same rule as the existing agents.
- **No Linear writes of matrix-derived tickets until a human approval event exists in the database.** This is a hard gate. Seeding the os-build and role-plan tracks (Phase 3.3) does not require matrix approval.
- **Schema-gate every agent output.** New agent outputs get zod contracts and validate-only loops, same pattern as `lib/schemas/findings.ts` and `publish.ts --validate-only`.
- **Secrets:** `SSC_EMAIL`, `SSC_PASSWORD`, `LANGFUSE_*` stay runner-side in `.env.local`. `LINEAR_API_KEY` goes in both runner `.env.local` and Vercel env (the app pushes and reads tickets server-side). Never commit any of it.
- **Attribution everywhere.** Every finding, review, vote, and generated artifact records whether a human or an agent produced it.
- **Idempotency.** Ticket pushes, dataset seeds, and scrapes must be safely re-runnable. Store external IDs and skip what exists.
- **Langfuse.** New agent stages (ticket drafter, taxonomy builder, Friday generator, theme clustering) get traced like the existing ones.

## 3. Sequence

| Phase | What | Depends on |
|---|---|---|
| 0 | Preflight: verify the engine actually works | nothing |
| 1 | Full assessment run + G2/Capterra scrape | 0 |
| 2 | Reviewer layer (human vs agent) + approval gate | 1 |
| 3 | Linear: draft, push on approval, work tab readback | 2 |
| 4 | Metrics tab: taxonomy, registry, sample dataset | 1 (taxonomy uses run artifacts) |
| 5 | Friday Update generator + 30-day role tickets | 3, 4 |
| 6 | Harden, test, deploy | all |

Phases 3 and 4 can interleave after 2 lands. Do not start 5 until the Linear board has real tickets and the metrics dataset exists, because the Friday Update reads both.

---

## Phase 0: Preflight

1. `npm run typecheck && npm run test:unit`. Fix anything red.
2. Confirm `.env.local` has SSC credentials, Langfuse keys, and `DATABASE_URL` (Neon). If running behind a TLS-inspecting proxy, remember the browser bridge notes in the README.
3. Smoke test: `browse.ts start` (background), `browse.ts login`, require `logged-in: yes`, `browse.ts stop`.
4. Resolve the Linear workspace: query the Linear API for the team named **SSC-ProductOS** (it exists in Riché's account). Record its team ID and key in a config file (`config/linear.json`), not hardcoded in components. Also resolve or create the labels and workflow states listed in Phase 3.1.

**Acceptance:** tests green, login smoke passes, `config/linear.json` populated.

## Phase 1: Full assessment run + feedback ingestion

### 1.1 Execute the run

Run `/platform-review` end to end with all three personas (ciso, vrm, gtm_cs), sequentially, per the existing skill: create run, browser + login, persona subagents with interactive investigation and screenshots, synthesis to `deliverable.json`, judge to `scores.json`, publish everything, finish the run.

**Acceptance:** run visible in the admin UI with screenshots per persona; deliverable validates (exactly 3 likes, 5 dislikes, ≥5 KFD rows, every row carrying customerPain, persona, rootCause, effort, firstAction); judge scores present for every finding; one Langfuse trace with per-persona spans.

### 1.2 Review-site scrape (same stage)

Build `runner/scrape-reviews.ts` reusing the existing Playwright runner.

- **Source order:** try Capterra first (typically lighter bot protection), then G2, then TrustRadius as backstop. Use whichever yields clean results in a single session. Low volume, throttled (2 to 5 second delays), one session, 30 to 60 reviews. Stop rather than fight aggressive bot walls; record which source worked in the ingestion panel.
- **Schema:** new `feedback_items` table: id, source (capterra|g2|trustradius|pendo|gong|gainsight), source_url, review_date, rating, title, body, reviewer_role_raw, persona_guess (ciso|vrm|gtm_cs|null, inferred from reviewer role), scraped_at.
- **UI:** an ingestion panel on the Planning screen listing every source with status. Scraped source: connected, item count, last-updated timestamp. Pendo, Gong, Gainsight, Snowflake: rendered as **available, not connected** stubs. Also display the personas' created date (from the persona.md files) per Riché's spec.

**Acceptance:** ≥30 feedback items stored with attribution and timestamps; ingestion panel renders connected vs available sources with last-updated stamps.

### 1.3 Theme clustering (stretch, do not block on it)

Agent stage that clusters `feedback_items` into themes and proposes persona/JTBD deltas as **proposals pending human approval**. If time is short, ship the honest stub: themes listed, each tagged "proposed persona update, pending approval," nothing auto-applied. Never mutate persona.md without an approval event.

**[GATE]** Riché reviews the run output and scrape before Phase 2 UI work begins.

## Phase 2: Reviewer layer + approval gate

### 2.1 Schema

New `reviews` table: id, run_id, finding_key, persona, **reviewer_type (human|agent)**, reviewer_name, verdict (up|down), comment, created_at. Judge scores remain in their own table but surface in the UI as agent reviews. Add `origin (agent|human)` to findings so Riché can add his own findings from his platform-notes doc alongside agent findings, clearly attributed.

### 2.2 UI

On the run detail page: up/down vote and comment on every finding, badge every review **Human** or **Agent**, and a form to add a human-origin finding (same fields as agent findings, validated by the same schema). Add a small accuracy strip per run: human agree-rate on agent findings, mean judge specificity/actionability, count of schema-validation retries. This strip is the "what AI got wrong and how we caught it" evidence for Prompt 4.

### 2.3 Approval

An **Approve matrix** action on the deliverable view, human-only, writing an `approvals` row (run_id, approved_by, approved_at). Approval is the sole trigger for Phase 3.2 ticket push. Show approval state on the deliverable.

**Acceptance:** votes and comments persist with reviewer_type; human findings can be added and render with attribution; approval event writes and displays; no ticket push possible pre-approval (test this).

## Phase 3: Linear integration + work tab

### 3.1 Conventions

- **Team:** SSC-ProductOS (from `config/linear.json`).
- **Hierarchy:** epics are parent issues; subtasks are sub-issues.
- **Labels:** `track:internal`, `track:external`, `phase:48h`, `phase:week-1`, `phase:week-2`, `phase:week-3`, `phase:day-30`, `origin:matrix`, `origin:os-build`, `origin:role-plan`.
- **Priorities:** 1=Urgent, 2=High, 3=Medium, 4=Low.
- **Due dates:** spaced across a 30-day window from a configurable day-0 (default: next Monday), weekdays only.

### 3.2 Draft and push (matrix-derived, external track)

- New agent `ssc-ticket-drafter`: reads the approved run's `deliverable.json`, writes `runs/<id>/tickets.json` per a new `TicketDraftSchema`. Mapping: every **Fix** and **Double Down** row becomes an epic (title, description embedding customerPain, persona(s), rootCause, effort, and the firstAction as the first sub-issue; 2 to 4 sub-issues total, sized to be startable). Every **Kill** row becomes a single CCB decision issue (evidence, affected accounts caveat, recommendation). All labeled `track:external`, `origin:matrix`. Validate-gate it like every other agent output.
- Push happens **app-side, deterministically, on approval**: a server route reads `tickets.json` content from the DB, creates issues via `@linear/sdk`, stores every created issue ID against the draft, and skips already-pushed drafts on re-run. Drafting is agentic (happens during the run); pushing is deterministic (happens at the approval click). This keeps the demo instant instead of waiting on the hourly routine.

### 3.3 Seed the internal and role tracks (no approval needed)

- **os-build backfill:** create Done issues for the work already shipped (persona engine, journeys, synthesizer, judge, schema gates, admin console, queue loop, Langfuse tracing), with real completion dates, labeled `track:internal`, `origin:os-build`. Create Todo/In Progress issues for the remaining phases of this plan. The board then tells the true story of this system being built, and the Friday Update has real shipped content from day one.
- **role-plan tickets:** create the 30-day operating plan tickets exactly as specified in **Appendix B**, labeled `track:internal`, `origin:role-plan`, with phase labels and due dates.

### 3.4 Work tab readback

New Work screen reading from the Linear API (server-side, cached in Postgres with a last-synced stamp; refresh on load plus a manual sync button):

- **Kanban view** grouped by workflow state.
- **Timeline view** across the 30-day window, grouped by phase label, epics with their sub-issues.
- **Internal/external toggle** filtering on `track:` labels: external shows the SSC product work from the matrix; internal shows the product-OS build plus the role operating plan.

**Acceptance:** approval click creates real issues on the SSC-ProductOS board with correct hierarchy, labels, priorities, due dates; re-click creates nothing new; work tab renders both views and the toggle from live Linear data with a last-synced stamp.

## Phase 4: Metrics tab

### 4.1 Feature taxonomy (agent task, yours to build)

New agent `ssc-taxonomy-builder`. Inputs: the persona corpora (`personas/*/corpus`), the run's journey snapshots and screenshots, and a light nav crawl via the existing browser runner if coverage gaps exist. Output: `data/feature-taxonomy.json`, human-editable, one entry per feature:

- feature, surface/route, one-line description
- **rhythm_class:** daily-ops | weekly-review | monthly-reporting | quarterly-assessment | event-driven
- **value_role:** retention-driver | expansion-driver | table-stakes
- **health_state:** strategic-growing | valuable-but-hidden | critical-to-few | shipped-not-adopted | legacy-kill
- rationale (2 to 3 sentences), evidence pointer (snapshot/screenshot label or corpus source)

Target 12 to 20 features spanning: scorecard/score factors, issues/findings, disputes, vendor portfolio/detection, questionnaires, alerts/rules, board reporting/report center, risk quantification, compliance, integrations, trust center, AI/agent features, MAX-adjacent surfaces. Every health state must have at least one feature. Riché edits this file directly; treat it as the source of truth after his pass.

### 4.2 Metrics registry

Implement the 14 metrics in **Appendix A** as data (a `metrics_registry` seed), each carrying: name, definition, data source, owner, review cadence, action trigger, related features (from taxonomy), rhythm-aware flag, visualization type. Render as cards: current value, spark/trend visualization, full metadata expandable underneath, related features linked. Note in the UI that sources shown (Pendo, Heap, Snowflake, FullStory, Jira, Gainsight) are the target integrations; current data is a generated sample.

### 4.3 Sample dataset generation

Build `runner/seed-metrics.ts` generating **12 weeks of weekly values** per applicable feature × metric pair into a `metric_observations` table (feature_id, metric_id, week_start, value, computed flags). Requirements:

- **Rhythm-aware:** usage patterns must respect each feature's rhythm_class. Quarterly-assessment features show sparse-but-healthy patterns; daily-ops features show dense ones. Usage Frequency (metric 3) judges each feature against its own class baseline, never a universal weekly bar. Per-feature Engagement (metric 2) is computed only for daily-ops and weekly-review rhythm classes.
- **Deliberately trip at least 4 action triggers across different metrics**, including at minimum: one feature tagged shipped-not-adopted via D30 activation below 25%, one legacy-kill candidate with reach under 2%, one critical-to-few feature (low reach, top-decile ARR concentration), and one tier-1 account crossing the renewal watchlist threshold. Tripped triggers render visibly on the dashboard (badge + the trigger text).
- Include a renewal-window effect: a subset of sample accounts inside a 90-day renewal window with usage trending down on retention-driver features.
- Feature Portfolio Health (metric 14) renders as the health-state board: counts per state, movers highlighted.

**Acceptance:** metrics tab renders 14 cards with visualizations and full metadata; ≥4 triggers visibly tripped; health board shows all five states populated; re-seeding is idempotent.

## Phase 5: Cadence + Friday Update

### 5.1 Friday Product & Engineering Update generator

New agent `ssc-friday-update` + skill. Inputs: **live Linear board state** (shipped = moved to Done in the window; slipped = past due date and not Done), metric deltas from `metric_observations`, the current run's top findings, and the accuracy strip data. Output sections, exactly per the take-home: shipped, slipped, customer impact, adoption, velocity, AI usage (containment rate + workflows run count + agree-rate), risks, one win to celebrate. Schema-gated (`FridayUpdateSchema`), stored with generated_at, rendered on the Work tab with a **Generate update** button. Optional: a Friday routine trigger using the existing queue pattern. Graceful on sparse weeks (the os-build backfill guarantees real shipped content for the first one).

### 5.2 Wire the role-plan tickets

Confirm the Appendix B tickets render correctly in the timeline by phase, and that the PM assessment ticket's full description (the Prompt 5 "how") is readable in the ticket detail.

**Acceptance:** one generated Friday Update rendered from real board + dataset state; regenerating replaces cleanly.

## Phase 6: Harden and deploy

1. Unit tests for new schemas, approval gate, push idempotency, dataset generator flags. E2E for: reviewer voting, approval → push, work tab views + toggle, metrics cards, Friday generation.
2. Update the README: three-screen architecture, new agents/skills, Linear setup, seed commands.
3. Deploy to Vercel with `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `LINEAR_API_KEY`. Verify the deployed app renders all three screens with real data.
4. Final pass: no secrets in git, `runs/` still ignored, screenshots render, Langfuse traces complete.

**Definition of done:** a reviewer with the admin password can open one URL and walk Planning → matrix with human + agent reviews → approve → watch real Linear tickets appear → Work tab (Kanban, timeline, toggle) → generated Friday Update → Metrics tab with tripped triggers and the health board. Every agent artifact traceable in Langfuse.

---

## Appendix A: Metrics registry (spec)

All review weekly unless noted. Riché may strike or edit before seeding; treat this table as the spec until he does.

| # | Metric | Definition | Source | Owner | Action trigger | Viz |
|---|---|---|---|---|---|---|
| 1 | Feature Adoption Rate | % of entitled accounts with ≥1 qualified event within the feature's rhythm window | Pendo | Product Ops | Adoption <60% of class baseline 2 consecutive windows → "underused" tag, owning PM writes adoption hypothesis | trend line |
| 2 | Engagement (WAU/MAU) | WAU/MAU stickiness ratio: product-level always; per-feature only for daily-ops and weekly-review rhythm classes (variable-rhythm features are judged by Usage Frequency instead) | Heap/Pendo | Product Ops | Stickiness down 15%+ over 4 weeks → engagement review, checked against last release and seasonality | trend line |
| 3 | Usage Frequency | Median days-between-uses vs the feature's rhythm-class baseline | Heap/Snowflake | Product Ops | Interval >2x baseline → dormancy watch before any "dead" verdict | baseline band |
| 4 | Task Completion Rate | % of feature sessions reaching the defined value action | Pendo funnels | Feature PM | Completion <40% → funnel review that week | funnel |
| 5 | Time on Task | Median time to complete the value action | Pendo/FullStory | Feature PM + Design | p50 +20% vs 4-week avg → regression check against last release | trend line |
| 6 | Activation Rate (D7/D30/D90) | % of entitled accounts hitting value action within 7/30/90 days of GA | Snowflake × Pendo | Releasing PM | D30 <25% → shipped-not-adopted tag, enters enablement queue or CCB | cohort bars |
| 7 | Time to Adoption | Days from GA to 10% adoption, trailing 8 weeks of releases | Jira × Pendo | Product Ops | >30 days → enablement gap review with PMM | dot plot |
| 8 | Friction Index | Rage clicks + errors + tagged support tickets per 100 active accounts | FullStory + support | Product Ops + Support | Weekly top 3 get named owner + first action at Monday standup | ranked bars |
| 9 | AI Containment Rate | % of AI-agent outputs accepted without human edit; escalation rate | App telemetry/Snowflake | AI PM | Acceptance <70% → prompt/eval review; failures logged to eval set | gauge + trend |
| 10 | Feature NPS | Feature-active user NPS vs company baseline | Pendo Listen | Product Ops | Feature NPS 10+ below company → verbatims auto-clustered into theme brief | diverging bars |
| 11 | Churn Risk Watchlist | Renewal-window accounts falling below rhythm on top retention-driver features | Snowflake × Gainsight | Product Ops + Data | Tier-1 drop → CSM play triggered in Gainsight, logged | watchlist table |
| 12 | Expansion PQLs | Accounts hitting entitlement ceilings or previewing gated modules | Snowflake + Pendo | Product Ops + GTM | Threshold crossed → routed to AE, tracked to pipeline created | watchlist table |
| 13 | Feature Revenue Concentration | Features with adoption <10% concentrated in top-decile ARR accounts | Snowflake × CRM | Product Ops | Kill candidate with tier-1 concentration → account-flagged review before CCB | scatter |
| 14 | Feature Portfolio Health | Feature count per health state; reclassified monthly, movers weekly | Composite | Product Ops | Shipped-not-adopted 2+ quarters, or legacy <2% adoption with no tier-1 dependency → forced CCB kill/invest decision | health board |

## Appendix B: 30-day role-plan tickets (create verbatim, adjust dates to day-0)

**Phase: 48h** (due day 1 to 2, priority 1)
1. **Run 1:1s across the product org.** Sub-issues: all PMs; PM leadership; design leadership; engineering leadership; GTM leadership and adjacent execs who depend on product (CS, finance). Standard question set: what's working, what's slow, where decisions stall, what you'd kill.
2. **Systems and process deep dive.** Audit what PMs actually use day to day: Jira PRODF configuration and hygiene, CCB minutes, Pendo/Sigma/Span dashboards, the weekly reporting stack, the existing Claude skills library (inventory: what exists, what's actually used, what's tribal).

**Phase: week-1** (due day 5, priority 1)
3. **Week-1 assessment to Sam.** Deliver first-week readout: state of the product org, processes, and systems; what's strong, what's broken, what I'd change first. Evidence from tickets 1 and 2.
4. **Product Ops org design recommendation.** Deliver to Sam: what the product ops team looks like, roles needed, structure for success, hiring sequence. (The ticket is to produce and present the recommendation; contents come from the week-1 findings.)

**Phase: week-2** (priority 2)
5. **Stand up the PM assessment system.** This ticket's description carries the Prompt 5 "how" in full:
   - **Dimensions and signals.** AI adoption: share of specs/prototypes produced with AI assistance, workflow-library usage, contributions back to the library. Customer obsession: customer calls attended monthly, customer verbatims cited in specs, engagement with Pendo Listen themes, whether meetings start with customer stories. Speed: pod cycle time, decision latency (age of open questions), five-day-mantra adherence, R/Y/G slip rate.
   - **Warning signs.** Specs with no customer evidence; AI usage flat after enablement; chronic yellow milestones; surprises surfacing first at CCB; blame-forward updates.
   - **Cadence.** Baseline in week 2 from 1:1s plus artifact review (each PM's last 3 specs and last 3 launches); scored monthly on a simple rubric; reviewed with Sam.
   - **Coaching plan trigger.** A dimension scoring low twice consecutively triggers a documented 30-day coaching plan: named behaviors, paired AI workflows, weekly 15-minute check.
   - **Escalation.** Two coaching cycles without movement, or a trust/values breach, or repeated customer-impact misses → recommend a role or people change to Sam, with the evidence trail.
6. **Metrics source of truth v1 live.** First version of the weekly KPI dashboard populated (this app's Metrics tab standing in), owners assigned per metric.

**Phase: week-3** (priority 2)
7. **AI workflows 2 through 5 stood up.** Feedback-to-theme clustering, matrix-to-Linear drafting, Friday Update generation, rhythm-drift/shipped-not-adopted detection: each live with a named human reviewer and a success metric.

**Phase: day-30** (priority 2)
8. **Day-30 systems check.** Dashboards live, Friday cadence running twice consecutively, PM assessment baseline complete for every PM, accountability mechanisms documented, escalation paths exercised at least once in the wild or by drill.

## Appendix C: Cut line if time runs short

Ship in this order, cutting from the bottom: (1) the full run + matrix + reviewer layer + approval, (2) Linear push + work tab, (3) metrics tab with sample dataset, (4) Friday generator, (5) scrape + ingestion panel, (6) theme clustering (honest stub acceptable). The memo and the final metrics edits are Riché's, not yours.
