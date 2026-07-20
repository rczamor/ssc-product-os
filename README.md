# SSC Product OS

A working answer to the Head of Product Operations & AI Innovations take-home, built as **one three-screen system** rather than five separate documents: **Planning** (the platform-review evaluation, matrix, and human+agent review layer), **Work** (the real Linear board this evaluation drives, plus the auto-generated Friday Update), and **Metrics** (the 14-metric weekly dashboard). A fourth screen, **Personas**, documents the persona corpus the evaluation agents ground their findings in.

Everything a reviewer needs to walk end-to-end lives behind one password-gated login: Planning → matrix with human + agent reviews → Approve → real Linear tickets appear → Work (Kanban, timeline, internal/external toggle, Friday Update) → Metrics (tripped triggers + health board). Every agent artifact is traceable in Langfuse.

## The three screens (+ Personas)

| Screen | Route | What it shows |
| --- | --- | --- |
| **Planning** | `/`, `/runs/[id]` | Evaluation runs, the Kill/Fix/Double-Down matrix, per-finding human+agent review controls, an accuracy strip (human agree-rate, judge scores), the customer-feedback ingestion panel, and the Approve-matrix gate. |
| **Work** | `/work` | The SSC-ProductOS Linear board, synced server-side: Kanban by workflow state, Timeline by 30-day phase (internal os-build/role-plan work vs. external product tickets drafted from an approved matrix), and the generated **Friday Product & Engineering Update**. |
| **Metrics** | `/metrics` | All 14 Appendix-A metrics as cards (current value, 12-week trend, tripped-trigger badges, expandable metadata + linked features) plus the Feature Portfolio Health board (5 states, movers). |
| **Personas** | `/personas` | The documented persona corpus (JTBD, KPIs, evaluation lens, sourced knowledge base) the evaluation agents ground every finding in. |

## How it works

```
┌─────────────────────────── Claude Code session / Routine ───────────────────────────┐
│  /platform-review (skill)                                                           │
│    ├─ runner/browse.ts ──── persistent Chromium ──── platform.securityscorecard.io  │
│    ├─ ssc-persona-ciso ┐                                                            │
│    ├─ ssc-persona-vrm  ├─ subagents: journey → investigate → findings.json          │
│    ├─ ssc-persona-gtm  ┘   (grounded in personas/<p>/persona.md + corpus)           │
│    ├─ ssc-synthesizer ──→ deliverable.json (3 likes / 5 dislikes / KFD)             │
│    └─ ssc-finding-judge ─→ scores.json (specificity / actionability 1-5)            │
│  runner/publish.ts / judge-push.ts / publish-feedback.ts / scrape-reviews.ts         │
│    ├──────────────→ Postgres (Neon; PGlite fallback) ──→ Next.js admin UI           │
│    └──────────────→ Langfuse (trace per run, spans, generations, scores)            │
│                                                                                       │
│  Human approves the matrix (Planning) ─── the SOLE trigger for the next step ───┐   │
│  lib/tickets.ts ── deterministic Kill/Fix/Double-Down → Linear ticket drafter    │   │
│  lib/linear-sync.ts ── pushDraftToLinear (race-safe, idempotent) ────────────────┘   │
│  runner/seed-linear.ts ── os-build backfill + 30-day role-plan (exempt from gate)    │
│  runner/seed-metrics.ts ── rhythm-aware 12-week sample dataset, ≥4 tripped triggers  │
│  lib/friday-update.ts ── deterministic Friday Update from the live board + dataset   │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

- **Personas are documented, not vibes**: `personas/<slug>/persona.md` (JTBD, KPIs, evaluation lens) plus a locally-hosted, web-researched knowledge corpus (`personas/<slug>/corpus/*.md`, all sourced). Agents must tie every finding to a JTBD/KPI.
- **Agents run inside Claude Code** (subagents in a session, or fired by an hourly Routine that polls the run-request queue). The admin UI queues requests; `runner/poll.ts` claims them atomically.
- **Deterministic transforms, not a second LLM layer, once a human has decided.** Turning an approved matrix into Linear tickets (`lib/tickets.ts`), and turning the live board + metrics dataset into a Friday Update (`lib/friday-update.ts`), are pure functions over real data — reproducible and safe to regenerate, not free-generated text.
- **The approval gate is the one hard rule**: a human `approvals` row is the *only* thing that can trigger a matrix→Linear push (`lib/db/queries.ts#isRunApproved`). The os-build backfill and 30-day role-plan seed are exempt — they're internal build/role work, not customer-facing product tickets.
- **Schema-gated everywhere**: zod contracts (`lib/schemas/*.ts`) with min-length and enum guards stand between generated/derived output and the database; agent scripts fix-and-retry until `--validate-only` passes.
- **Observability**: one Langfuse trace per platform-review run (trace id = run id) with per-persona spans, journey-stop spans, generations, and LLM-as-judge scores.

## Repo map

| Path | What |
| --- | --- |
| `personas/` | Documented personas + sourced knowledge corpus (rendered at `/personas`) |
| `data/` | `feature-taxonomy.json` (19 features, health states, rhythm classes) + `metrics-registry.json` (the 14 Appendix-A metrics) |
| `config/linear.json` | Linear workspace resolution — team/project/label/state ids, `day0`. Ids only; `LINEAR_API_KEY` stays in env. |
| `.claude/agents/` | The five persona-evaluation agents: 3 personas, synthesizer, judge |
| `.claude/skills/` | `platform-review` (orchestrator), `ssc-browse`, `persona-eval`, `publish-run`, `langfuse-trace` |
| `runner/` | Browser CLI, journey executor, run lifecycle, publish/judge-push, queue poll, feedback scrape/publish, Linear ticket draft/seed, metrics seed |
| `runner/journeys/` | Scripted coverage per persona (the floor; agents deviate interactively) |
| `lib/` | zod schemas, Drizzle schema + queries, DB driver switch (Neon ⇄ PGlite), synthesis, reviews/accuracy, tickets, Linear client + sync, metrics + metric-generator, Friday Update, auth |
| `app/` | Next.js admin console (password-gated): Planning, Work, Metrics, Personas, run detail, APIs |
| `tests/` | Vitest unit suite (PGlite-backed) + Playwright e2e suite |

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in secrets (never committed)
npm run dev                  # admin UI on :3000 (PGlite until DATABASE_URL is set)
npm run test:unit && npm run test:e2e
```

Run a live evaluation from a Claude Code session in this repo:

```
/platform-review
```

or headless pieces by hand (prefer `node bin/run.mjs npx tsx <script>` — it loads `.env.local` in-process, no shell expansion):

```bash
node bin/run.mjs npx tsx runner/browse.ts start --run adhoc &   # persistent browser
node bin/run.mjs npx tsx runner/browse.ts login
node bin/run.mjs npx tsx runner/journey.ts --run <id> --persona ciso
```

## Linear setup + seed commands

Linear work is isolated inside a dedicated **SSC-ProductOS project** within the workspace's team, filtered by `track:internal|external`, `phase:48h|week-1|week-2|week-3|day-30`, and `origin:matrix|os-build|role-plan` labels — never mixed with the team's other work. `config/linear.json` records the resolved team/project/label/state ids (safe to commit); `LINEAR_API_KEY` is the only secret, set in `.env.local` and in Vercel.

Every runner script below supports `--validate-only` (prints what it *would* do, no key needed) and is idempotent (safe to re-run):

```bash
node bin/run.mjs npx tsx runner/seed-linear.ts --validate-only   # preview the os-build + 30-day role-plan seed
node bin/run.mjs npx tsx runner/seed-linear.ts                   # create it in Linear (exempt from the approval gate)
node bin/run.mjs npx tsx runner/seed-metrics.ts --validate-only  # preview the 12-week metrics dataset
node bin/run.mjs npx tsx runner/seed-metrics.ts                  # (re)seed metric_observations — full delete-then-insert
node bin/run.mjs npx tsx runner/publish-feedback.ts              # publish data/feedback-seed.json (idempotent on dedupe_key)
node bin/run.mjs npx tsx runner/scrape-reviews.ts                # read-only review-site scrape (throttled, stops on bot walls)
```

Matrix-derived Linear tickets are drafted (`runner/draft-tickets.ts` / `POST /api/runs/[id]/tickets/draft`) and pushed (`POST /api/runs/[id]/tickets/push`) only from the app, and only after a human clicks **Approve matrix** on Planning — that approval is the sole trigger, never automated. The Work tab's **Sync** button (or `POST /api/linear/sync`) refreshes the cached board from live Linear.

## Deploying (Vercel + Neon + Linear)

1. Deploy this repo to Vercel (the app lives at the root; framework auto-detected).
2. Create a Neon Postgres database (Vercel Marketplace → Neon, or neon.tech). `DATABASE_URL` set → the app auto-migrates on first connect (idempotent, race-tolerant across cold starts).
3. Set env vars on the Vercel project — `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `LINEAR_API_KEY` — and redeploy.
4. Optional demo-before-real-data: `DB_SEED_ON_EMPTY=1` populates an empty deployed database with the labeled demo run, feedback, and metrics dataset (skips itself once any run exists) — writes are real and persist once `DATABASE_URL` is set, unlike the ephemeral PGlite-only path.
5. Runner-side secrets (`SSC_EMAIL`, `SSC_PASSWORD`, `LANGFUSE_*`) stay in the Claude Code environment's `.env.local` only — the deployed app never sees them. To drive the admin-UI queue → poll loop or seed Linear/metrics against the deployed database, the runner's `.env.local` also needs the same `DATABASE_URL` (and `LINEAR_API_KEY`) as the deployed app.

## The run-request loop

Admin UI **Queue run** → `run_requests` row (`queued`) → hourly Claude Code Routine runs `runner/poll.ts` (atomic claim via `FOR UPDATE SKIP LOCKED`) → `/platform-review --request <id>` executes → results + screenshots land in Postgres → admin UI. Immediate runs: `/platform-review` in any session.

## Notes & limits

- The browser bridge routes page traffic through Playwright's Node-side fetch when `HTTPS_PROXY` is set (TLS-inspecting proxies reset Chromium's ClientHello); drop the env var to browse directly. The bridge covers HTTP(S) page requests, not WebSocket/service-worker traffic — fine for the SSC SPA's read-only journeys.
- File-backed PGlite (`.pglite-data/`) lets the runner's separate processes share a database without `DATABASE_URL`, but a single PGlite dir is single-writer: don't run the dev server and a runner publish against it at the same time. Use `DATABASE_URL` (Neon) for concurrent access.
- Screenshots are stored as JPEG bytes in Postgres (`bytea`); a `blob_url` column reserves a Vercel Blob upgrade path.
- The demo SSC login is a shared, company-provided evaluation account; agents are instructed to stay read-only (no invites, no edits, cancel out of side-effect flows).
- The Metrics tab's dataset is a generated sample (deterministic, seeded PRNG) grounded in the real evaluation run's evidence — every card's "source" notes it's a target integration, not a live feed, until that integration exists.
- `linear_cache.completedAt` only reflects issues completed *since the last sync* — the Friday Update's Shipped section shows the board's last-synced timestamp so that boundary is visible rather than silently assumed.
