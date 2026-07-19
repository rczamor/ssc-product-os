---
name: ssc-browse
description: Drive the SecurityScorecard platform in a real browser via runner/browse.ts. Use whenever a persona agent or orchestrator needs to log in, navigate, snapshot, click through, or screenshot the SSC product. Documents the full command contract and the login-recovery playbook.
---

# Driving the SecurityScorecard platform

One long-lived Chromium session (started once per run) holds login state; every
command below is a short process that attaches to it over CDP, acts, prints,
and exits. Always run commands from the repo root.

**Env prefix**: run every command as

```bash
set -a; . ./.env.local; set +a; npx tsx runner/browse.ts <cmd> …
```

(sourcing exports `NODE_EXTRA_CA_CERTS` for the TLS-intercepting proxy — the
script loads the rest of `.env.local` itself, but that variable must exist
before Node starts).

## Command contract

| Command | What it does / prints |
| --- | --- |
| `start --run <id>` | Launch the persistent browser (RUN IN BACKGROUND — it stays alive). Prints `ready …`. Reuses an already-running session. |
| `login` | Logs in with `SSC_EMAIL`/`SSC_PASSWORD` from env. Prints `logged-in: yes` or `logged-in: no` + a debug screenshot path. Can take ~60s; the SPA is slow. |
| `goto <url> [--wait "<selector>"]` | Navigate. Prints final url + title. Prints `SESSION_EXPIRED` if bounced to a login wall. |
| `snapshot [--max N]` | Aria (accessibility) snapshot of the page — your primary way to "see". Default cap 40k chars. |
| `click "<selector>"` | Click. CSS or Playwright selectors (`text=Portfolios`, `button:has-text("Export")`). Prints resulting url/title. |
| `fill "<selector>" "<text>"` | Fill an input. |
| `press <key>` | Keyboard key (Enter, Escape, ArrowDown…). |
| `screenshot --run <id> --persona <p> --label <slug> [--full]` | JPEG to `runs/<id>/<p>/<slug>.jpg` and records it in `adhoc.json` (published to the DB later). Label = lowercase slug. |
| `eval "<js>"` | Evaluate a JS expression in the page, print JSON. Good for extracting counts/links: `eval "document.querySelectorAll('table tbody tr').length"`. |
| `stop` | Shut the browser down (end of run only). |

## Platform map (hash-routed SPA)

- `#/home` — workspace with tabs: Vendor Risk Management / Vendor Engagement / Self-Monitoring Launchpad / External Attack Surface Management
- `#/scorecard/securityscorecardtech.com` — own scorecard (left rail: Score Factors, History, Issues, Compliance, Evidence Locker, Risk Quantification…)
- `#/scorecard/<domain>` — any company's scorecard (e.g. `#/scorecard/tesla.com`)
- `#/portfolios/all`, `#/my-vendors?monitored=true` — vendor portfolio surfaces
- `#/assessments` (questionnaires), `#/action-plans`, `#/contact-manager`, `#/requests-log`
- `#/report-center`, `#/rules`, `#/marketplace`, `#/asi`, `#/notifications/standard`

## Rules

- NEVER print, echo, or write `SSC_EMAIL`/`SSC_PASSWORD` or any cookie/token anywhere. The `login` command handles credentials itself.
- Write only under `runs/`. Screenshots go through the `screenshot` command so they're tracked for publishing.
- Data-heavy views render slowly: after `goto`, if the snapshot shows spinners/"Loading", wait and re-`snapshot` before judging the page.
- This is a shared demo account on a production system: read and navigate freely, but do not send vendor requests/invitations, do not delete or edit portfolios/rules, and cancel out of any flow that emails a third party.

## Login recovery playbook

If `login` prints `logged-in: no` or a command prints `SESSION_EXPIRED`:

1. `goto https://platform.securityscorecard.io/` then `snapshot` — identify the form.
2. `fill 'input[type="email"]' "$SSC_EMAIL"` style manual steps (use env var interpolation in your shell so the value itself is never in your transcript), `fill 'input[type="password"]' …`, then `click 'button[type="submit"]'`.
3. Wait ~20s, `snapshot`; success = app chrome (nav tabs) instead of the form.
4. Still failing → capture `screenshot --label login-blocked`, report the run as blocked; do NOT retry more than twice (lockout risk).
