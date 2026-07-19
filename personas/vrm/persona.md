---
name: The Vendor Risk Manager
slug: vrm
created: "2026-07-19"
title: Director of Third-Party Risk Management
company_profile: Meridian Mutual Financial, a fictional mid-size US financial services and insurance firm (~8,500 employees, ~1,400 active third parties) regulated under NYDFS Part 500 and the 2023 Interagency Guidance, running TPRM with a team of four analysts.
jtbd:
  - Tier and onboard new vendors inside the procurement SLA without becoming "the department of no"
  - Run risk-proportionate due diligence (SIG Lite/Core, CAIQ, custom questionnaires) and validate answers against outside-in evidence
  - Continuously monitor the vendor portfolio and triage score drops, breach alerts, and new CVE exposure within hours, not weeks
  - Chase vendor remediation to closure with documented SLAs, escalations, and evidence
  - Map fourth-party dependencies and flag concentration risk before it becomes an incident
  - Produce board- and regulator-ready reporting that defends every risk-acceptance decision
  - Rationalize tooling and analyst hours so coverage grows faster than headcount
kpis:
  - Percentage of Tier 1 vendors with a current assessment AND active continuous monitoring (target ≥95%)
  - Mean time to complete initial vendor risk assessment (target <10 business days; industry average 30–45)
  - Critical finding remediation rate within SLA (target ≥90%; <80% on criticals is a governance red flag)
  - Mean time to detect and act on a material vendor risk change (hours, not weeks)
  - Percentage of total portfolio under continuous monitoring (vs. assessed-only)
  - Average portfolio security rating trend, reported quarterly to the risk committee
  - Cost per assessment / assessments completed per analyst per quarter
---

## Role Context

She owns third-party cyber risk end to end at a regulated financial services firm: intake, tiering, due diligence, continuous monitoring, remediation chase, and offboarding for roughly 1,400 third parties, ~180 of which are Tier 1 (customer NPI, production access, or business-critical). Her program answers to a CISO and a risk committee, and gets examined — NYDFS Part 500 and the OCC/Fed/FDIC Interagency Guidance both treat ongoing monitoring as a baseline expectation, not a nice-to-have. SecurityScorecard is open in a browser tab from 8am to 6pm. It is her portfolio radar, her evidence source when a vendor's questionnaire answers smell wrong, and her negotiating leverage when she needs a vendor to patch something.

## Goals

Increase coverage without headcount: monitor 100% of the portfolio continuously even though her team can only deeply assess a fraction of it each year. Compress assessment cycle time so procurement stops routing around her. Turn the annual "questionnaire theater" into risk-proportionate, evidence-backed diligence. Survive exams with a defensible paper trail. Keep the third-party breach that is statistically coming (third-party involvement in breaches doubled to 30% in the 2025 Verizon DBIR) from being one of *her* vendors — or at least prove she saw it, escalated it, and documented the response.

## Jobs-to-be-Done (expanded)

- **Intake and tiering:** score inherent risk from data access, system connectivity, and criticality; assign Tier 1–4; decide assessment depth (SIG Lite vs. Core vs. ratings-only).
- **Due diligence:** issue questionnaires, cross-check self-reported answers against outside-in ratings findings, review SOC 2s, and document residual risk for sign-off.
- **Continuous monitoring:** watch score changes daily; when a Tier 1 vendor drops a letter grade or shows up in breach chatter, open an investigation the same day.
- **Remediation chase:** convert findings into vendor-facing action plans with deadlines; escalate through business owners and contracts when vendors go dark.
- **Fourth-party and concentration analysis:** know which single provider underpins 40 of her vendors before the next MOVEit-style event.
- **Reporting:** quarterly portfolio posture to the risk committee; on-demand evidence packages for examiners and internal audit.

## Top Pain Points

- Questionnaire fatigue on both sides: SIG Core runs to 855 questions; vendors take weeks to respond and answers are self-reported marketing.
- False positives and stale findings in ratings data — misattributed IPs, CDN artifacts, decayed issues — that she has to explain to a vendor before the vendor will engage.
- Vendors disputing the score instead of fixing the problem; disputes that take weeks kill her SLA metrics.
- Alert noise: score-change notifications without materiality context force manual triage.
- Fourth-party blindness: her vendors won't voluntarily disclose their own dependencies.
- Proving program value: leadership sees cost; she has to show risk reduced per dollar.

## KPIs and How They're Measured

Coverage (% of Tier 1 with current assessment + live monitoring) comes straight from platform portfolio reports. Assessment cycle time is tracked from intake ticket to residual-risk sign-off. Remediation SLA adherence is measured per finding severity — 7 days for criticals on Tier 1, 30 days for mediums — with closure requiring validated evidence, not vendor say-so. Mean time to detect is the gap between a public event (breach disclosure, CVE, score drop) and her documented triage. All of it rolls into a quarterly risk-committee deck; the exam version needs per-vendor drill-down.

## A Day in the Life

8:15 — coffee, portfolio dashboard: two score drops overnight, one Tier 1. Drill into the findings; one is a real exposed service, one looks like a decayed finding on a shared IP. 9:30 — onboarding queue: three new vendors from procurement, tier them, kick off one SIG Lite and two ratings-only reviews. 11:00 — call with a payments vendor who is disputing an endpoint finding; she screen-shares the scorecard. 1:00 — remediation review: 14 open action plans, 3 past SLA, draft escalation to the business owner. 3:00 — build the quarterly board slide: average rating trend, coverage, overdue criticals. 4:30 — fourth-party query: which vendors run the file-transfer product in this morning's CISA advisory.

## Evaluation Lens: What "Good" Looks Like in a Security Ratings Platform

Accurate attribution and fast dispute resolution (48–72 hours, transparently logged); scoring methodology she can defend to a vendor CISO and an examiner (breach-likelihood correlation, published factor weights); materiality-aware alerting tiered by vendor criticality; native vendor collaboration — free vendor access, action plans with deadlines, shared evidence; questionnaire workflow integrated with ratings evidence; fourth-party detection with confidence scoring; board reporting that requires zero Excel surgery; APIs into her GRC and ticketing stack.

## Red Flags That Would Make Them Churn

Score volatility she can't explain to stakeholders; a methodology change that reshuffles her portfolio grades mid-exam-cycle without warning; dispute backlogs that stretch past a week; vendors reporting the invite/collaboration flow is confusing or feels like a sales funnel; paywalling previously included capabilities (fourth-party visibility, integrations) into add-ons; alert spam that her analysts start ignoring; and any accuracy incident that makes a vendor CISO publicly dismiss the score — because her program's credibility is borrowed from the platform's.
