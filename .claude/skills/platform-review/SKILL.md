---
name: platform-review
description: Orchestrates a full SecurityScorecard persona evaluation run — browser session, CISO/VRM/GTM persona subagents, synthesis, judge scoring, database publish, Langfuse trace. Use when asked to run a platform review, when a queued run request needs executing, or via /platform-review [--personas ciso,vrm,gtm_cs] [--request <id>].
---

# /platform-review — full persona evaluation run

Runs the take-home Prompt-1 evaluation end-to-end. Default personas:
`ciso,vrm,gtm_cs` (override with `--personas`). If executing a claimed queue
request, pass `--request <id>` so the request row tracks the run.

Every runner command uses the env prefix: `set -a; . ./.env.local; set +a;`.

## Steps

1. **Create the run**
   ```bash
   set -a; . ./.env.local; set +a; npx tsx runner/run.ts create --trigger <slash|routine|ui> [--request <id>] [--personas …]
   ```
   Capture the printed `RUN_ID=<uuid>`.

2. **Start the browser + login** (start MUST run in background — it stays alive)
   ```bash
   set -a; . ./.env.local; set +a; npx tsx runner/browse.ts start --run $RUN_ID   # run_in_background
   set -a; . ./.env.local; set +a; npx tsx runner/browse.ts login
   ```
   Require `logged-in: yes`. On failure follow the ssc-browse recovery
   playbook (max 2 attempts), else finish the run as failed with the error.

3. **Personas — SEQUENTIALLY** (they share one browser; never parallel).
   For each persona `<p>`, launch the matching subagent (`ssc-persona-ciso`,
   `ssc-persona-vrm`, `ssc-persona-gtm`) via the Agent tool with prompt:
   "RUN_ID=<id>. Evaluate per your instructions and write
   runs/<id>/<p>/findings.json until --validate-only passes."
   Then publish:
   ```bash
   set -a; . ./.env.local; set +a; npx tsx runner/publish.ts --run $RUN_ID --persona <p>
   ```
   If the subagent can't produce a valid file after 3 validation attempts:
   `publish.ts --run $RUN_ID --persona <p> --mark-failed` and continue with
   the remaining personas.

4. **Stop the browser**: `… browse.ts stop`

5. **Synthesize**: launch `ssc-synthesizer` with RUN_ID; it writes
   `runs/<id>/deliverable.json`. Then:
   ```bash
   set -a; . ./.env.local; set +a; npx tsx runner/publish.ts --run $RUN_ID --deliverable
   ```

6. **Judge**: launch `ssc-finding-judge` with RUN_ID; it writes
   `runs/<id>/scores.json`. Then:
   ```bash
   set -a; . ./.env.local; set +a; npx tsx runner/judge-push.ts --run $RUN_ID
   ```

7. **Finish**
   ```bash
   set -a; . ./.env.local; set +a; npx tsx runner/run.ts finish --run $RUN_ID
   ```

8. **Report**: summarize likes/dislikes/KFD counts, judge averages, and where
   to view results (admin UI `/runs/<id>`, `runs/<id>/deliverable.md`,
   Langfuse trace id = run id).

## Failure policy

- Login failure → run finishes `failed` with the exact error; no personas run.
- Single persona failure → that persona is marked failed; the run continues.
- Synthesis requires ≥2 completed personas; below that, skip synthesis/judge
  and finish `failed`.

## Queue integration (Routine)

The hourly Routine runs:
```bash
set -a; . ./.env.local; set +a; npx tsx runner/poll.ts
```
`QUEUE_EMPTY` → reply "queue empty" and stop. `CLAIMED {json}` → execute this
skill with `--request <id>` and the request's personas.
