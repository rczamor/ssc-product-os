---
name: langfuse-trace
description: How run observability flows to Langfuse — trace structure, ids, scores, and how to verify or debug traces for a platform-review run. Use when wiring, checking, or explaining telemetry/evals.
---

# Langfuse observability

All Langfuse calls happen inside runner scripts (`runner/trace.ts`); agents
never handle keys. Keys live in `.env.local` (`LANGFUSE_PUBLIC_KEY`,
`LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`). Without keys every helper no-ops
and prints one warning — runs still work.

## Trace structure (trace id == run id)

```
trace platform-review                      id = <run uuid>
├─ span persona:ciso                       id = <run>-ciso
│   ├─ span stop:<label>                   one per journey stop (url, timing)
│   └─ generation persona-eval-ciso        output = validated PersonaOutput
├─ span persona:vrm … / persona:gtm_cs …
├─ generation synthesis                    output = validated Deliverable
└─ scores
    ├─ specificity / actionability        per finding (judge), attached to the persona span
    └─ deliverable_quality                run-level mean
```

Who writes what: `run.ts create` → trace · `journey.ts` → persona/stop spans ·
`publish.ts` → generations · `judge-push.ts` → scores. Scripts flush before
exit (`flushAsync`) — short-lived processes lose unflushed events otherwise.

## Verify a run's trace

Open `https://cloud.langfuse.com` → project → Traces → search the run id
(the admin UI links it per run). Programmatic check:

```bash
set -a; . ./.env.local; set +a; npx tsx -e "
async function main() {
  const r = await fetch(process.env.LANGFUSE_BASE_URL + '/api/public/traces/<RUN_ID>', {
    headers: { Authorization: 'Basic ' + Buffer.from(process.env.LANGFUSE_PUBLIC_KEY + ':' + process.env.LANGFUSE_SECRET_KEY).toString('base64') } });
  console.log(r.status, JSON.stringify(await r.json()).slice(0, 400));
}
main();"
```

## Debugging

- TLS errors from behind the proxy → the env prefix wasn't used
  (`NODE_EXTRA_CA_CERTS` must be exported before Node starts).
- Missing spans/generations → the writing script exited before flush; re-run
  it (ids are deterministic, so re-runs upsert rather than duplicate).
- Evals beyond the built-in judge: Langfuse-hosted evaluators can be added in
  the Langfuse UI on top of the same traces (optional upgrade; needs model
  credentials configured there).
