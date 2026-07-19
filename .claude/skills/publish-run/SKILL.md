---
name: publish-run
description: Validate and publish persona evaluation artifacts (findings.json, deliverable.json, scores.json) to the Postgres backend and Langfuse. Use after persona agents finish writing artifacts, or to republish/repair a run's data.
---

# Publishing run artifacts

All commands from the repo root with the env prefix
`set -a; . ./.env.local; set +a;` (exports DB/Langfuse config + proxy CA).

| Goal | Command |
| --- | --- |
| Validate a persona file (agent fix-loop) | `npx tsx runner/publish.ts --run <id> --persona <p> --validate-only` |
| Publish a persona (screenshots + evaluation + findings + Langfuse generation) | `npx tsx runner/publish.ts --run <id> --persona <p>` |
| Validate the deliverable | `npx tsx runner/publish.ts --run <id> --deliverable --validate-only` |
| Publish the deliverable (renders deliverable.md too) | `npx tsx runner/publish.ts --run <id> --deliverable` |
| Mark a persona failed (after 3 failed validations) | `npx tsx runner/publish.ts --run <id> --persona <p> --mark-failed` |
| Push judge scores to DB + Langfuse | `npx tsx runner/judge-push.ts --run <id>` |
| Close out the run | `npx tsx runner/run.ts finish --run <id> [--status failed --error "…"]` |

Notes:
- Publishing is idempotent — republishing a persona replaces its rows.
- `SCHEMA INVALID` output lists exact zod paths; hand them back to the agent.
- Without `DATABASE_URL`, data lands in local PGlite (`.pglite-data/`) — the
  same commands re-run against Neon once `DATABASE_URL` is set.
- Screenshot bytes are stored in Postgres; the admin UI serves them at
  `/api/screenshots/<id>`.
