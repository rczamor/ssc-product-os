# SSC Product OS — Persona Evaluation Agents

AI persona agents that evaluate the [SecurityScorecard](https://securityscorecard.com) platform the way three real customers would — a **CISO**, a **vendor risk manager (VRM)**, and a **customer-facing GTM/CS lead** — by driving a live browser through the product, then publishing structured, judged evaluations to a password-protected admin console.

Built for Prompt 1 of the Head of Product Operations & AI Innovations take-home ("Platform Review — Customer Obsession & Product Taste"): each run produces **3 likes, 5 dislikes, and a Kill / Fix / Double-Down table** where every issue carries customer pain, persona impacted, root cause type (UX / data / workflow / packaging / strategy), effort, and a first action for this week.

## How it works

```
┌────────────────────── Claude Code session / Routine ──────────────────────┐
│  /platform-review (skill)                                                 │
│    ├─ runner/browse.ts ──── persistent Chromium ──── platform.securityscorecard.io
│    ├─ ssc-persona-ciso ┐                                                  │
│    ├─ ssc-persona-vrm  ├─ subagents: journey → investigate → findings.json│
│    ├─ ssc-persona-gtm  ┘   (grounded in personas/<p>/persona.md + corpus) │
│    ├─ ssc-synthesizer ──→ deliverable.json (3 likes / 5 dislikes / KFD)   │
│    └─ ssc-finding-judge ─→ scores.json (specificity / actionability 1-5)  │
│  runner/publish.ts / judge-push.ts                                        │
│    ├──────────────→ Postgres (Neon; PGlite fallback) ──→ Next.js admin UI │
│    └──────────────→ Langfuse (trace per run, spans, generations, scores)  │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Personas are documented, not vibes**: `personas/<slug>/persona.md` (JTBD, KPIs, evaluation lens) plus a locally-hosted, web-researched knowledge corpus (`personas/<slug>/corpus/*.md`, all sourced). Agents must tie every finding to a JTBD/KPI.
- **Agents run inside Claude Code** (subagents in a session, or fired by an hourly Routine that polls the run-request queue). The admin UI queues requests; `runner/poll.ts` claims them atomically.
- **Schema-gated output**: zod contracts (`lib/schemas/findings.ts`) with min-length and enum guards stand between LLM output and the database; agents fix-and-retry until `publish.ts --validate-only` passes.
- **Observability**: one Langfuse trace per run (trace id = run id) with per-persona spans, journey-stop spans, generations, and LLM-as-judge scores.

## Repo map

| Path | What |
| --- | --- |
| `personas/` | Documented personas + sourced knowledge corpus (rendered at `/personas` in the UI) |
| `.claude/agents/` | The five agents: 3 personas, synthesizer, judge |
| `.claude/skills/` | `platform-review` (orchestrator), `ssc-browse`, `persona-eval`, `publish-run`, `langfuse-trace` |
| `runner/` | Browser CLI, journey executor, run lifecycle, publish, judge-push, queue poll |
| `runner/journeys/` | Scripted coverage per persona (the floor; agents deviate interactively) |
| `lib/` | zod schemas, Drizzle schema, DB driver switch (Neon ⇄ PGlite), synthesis, auth |
| `app/` | Next.js admin console (password-gated): runs, run detail, personas, APIs |
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

or headless pieces by hand:

```bash
set -a; . ./.env.local; set +a
npx tsx runner/browse.ts start --run adhoc &   # persistent browser
npx tsx runner/browse.ts login
npx tsx runner/journey.ts --run <id> --persona ciso
```

## Deploying (Vercel + Neon)

1. Deploy this repo to Vercel (the app lives at the root; framework auto-detected).
2. Create a Neon Postgres database (Vercel Marketplace → Neon, or neon.tech) and run migrations: `DATABASE_URL=… npm run db:migrate`.
3. Set three environment variables on the Vercel project — `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET` — and redeploy. Until `DATABASE_URL` is set the deployed app serves seeded demo data from in-process PGlite.
4. Runner-side secrets (`SSC_EMAIL`, `SSC_PASSWORD`, `LANGFUSE_*`) stay in the Claude Code environment's `.env.local` only — the deployed app never sees them.

## The run-request loop

Admin UI **Queue run** → `run_requests` row (`queued`) → hourly Claude Code Routine runs `runner/poll.ts` (atomic claim via `FOR UPDATE SKIP LOCKED`) → `/platform-review --request <id>` executes → results + screenshots land in Postgres → admin UI. Immediate runs: `/platform-review` in any session.

## Notes & limits

- The browser bridge routes page traffic through Playwright's Node-side fetch when `HTTPS_PROXY` is set (TLS-inspecting proxies reset Chromium's ClientHello); drop the env var to browse directly.
- PGlite mode is single-process: don't run the dev server and runner publishes simultaneously without `DATABASE_URL`.
- Screenshots are stored as JPEG bytes in Postgres (`bytea`); a `blob_url` column reserves a Vercel Blob upgrade path.
- The demo login is a shared, company-provided evaluation account; agents are instructed to stay read-only (no invites, no edits, cancel out of side-effect flows).
