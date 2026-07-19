---
title: "Continuous Monitoring vs Point-in-Time: Alerting, Triage, and Fourth-Party Risk"
persona: vrm
tags: [continuous-monitoring, alerting, fourth-party, concentration-risk]
sources:
  - title: "Bitsight: Continuous Vendor Monitoring and Fourth-Party Risk for Regulated Industries in 2026"
    url: https://www.bitsight.com/guides/continuous-vendor-monitoring-and-fourth-party-risk-for-regulated-industries-in-2026
  - title: "Verizon: 2025 Data Breach Investigations Report announcement"
    url: https://www.verizon.com/about/news/2025-data-breach-investigations-report
  - title: "SecurityScorecard: Automatic Vendor Detection"
    url: https://securityscorecard.com/platform/automatic-vendor-detection/
  - title: "SecurityScorecard Help Center: A Closer Look at Scoring 3.0 Vocabulary and Breach Likelihood"
    url: https://support.securityscorecard.com/hc/en-us/articles/22601556325147-A-Closer-Look-at-Scoring-3-0-Vocabulary-and-Breach-Likelihood
retrieved_at: "2026-07-19"
---

## Why point-in-time assessment fails

Bitsight's 2026 regulated-industries guide names four structural failures of periodic questionnaires: **stale data** ("a questionnaire completed in January reflects controls from a period that may no longer exist by March"), **self-report bias** (no independent verification), **coverage gaps** (no team can deep-assess hundreds of vendors on a recurring cycle), and **no signal between cycles** ("a vendor who passes an annual review in February may be actively compromised by April"). Only about one in three organizations continuously monitors all third-party relationships — and the threat data says the gap matters: third-party involvement in breaches doubled from 15% to 30% in the 2025 Verizon DBIR, with 81% of those involving system intrusion.

Regulators have converged on the same conclusion. The 2023 Interagency Guidance (OCC/Fed/FDIC) makes risk-based ongoing monitoring a lifecycle baseline; NYDFS Part 500's 2023 amendments increased supply-chain scrutiny in examinations; DORA (effective January 2025) requires ICT contract registers and — under Article 28 — assessment of concentration risk from critical providers and their subcontractors. A once-a-year PDF cannot satisfy a continuous obligation.

## Ratings as the monitoring signal

Continuous monitoring in practice means externally observed telemetry compressed into a score. SecurityScorecard's Scoring 3.0 grades A–F across 10 factors from 200+ weighted issue types, with weights derived from breach-history correlation; the company's long-standing claim is that F-rated companies are ~13.8x more likely to suffer a breach than A-rated ones. For the practitioner, the score itself is less important than the *delta*: a stable B is background noise, a B-to-D drop on a Tier 1 vendor is a same-day investigation.

## Score-change triage practice

Bitsight's guide codifies what mature teams do:

- **Tiered alert thresholds:** a grade drop on a Tier 1 vendor triggers immediate escalation; the same drop on a Tier 3 vendor enters standard review. Untiered alerting produces noise that trains analysts to ignore the feed.
- **Ownership routing:** "alerts that route to a generic inbox get triaged inconsistently" — every vendor needs a named owner who receives its alerts.
- **Workflow integration:** alerts land in the GRC/ticketing stack (ServiceNow, etc.), not a parallel console, so triage leaves an audit trail examiners can follow.
- **Event-driven reassessment:** a material score change or breach disclosure triggers an out-of-cycle assessment, replacing fixed-calendar reassessment for stable vendors.

Triage discipline: confirm the finding is real and attributed correctly (shared hosting and CDN misattribution is the top false-positive source), assess materiality against what the vendor actually does for you, then either close with rationale or open a remediation action — every step documented.

## Fourth-party and concentration risk

Fourth parties — the vendors your vendors depend on — are invisible to questionnaires because "your vendors are not required to disclose every downstream dependency" (Bitsight). MOVEit (2023) and CrowdStrike (2024) demonstrated the failure mode: one shared dependency cascading across an entire portfolio simultaneously. Practice: passively map vendor tech stacks, identify shared dependencies on a recurring schedule, and trigger reviews when a new vendor adds weight to an already-concentrated fourth party. SecurityScorecard productizes this as Automatic Vendor Detection, which surfaces third- and fourth-party relationships with Relationship Confidence Scores and flags concentration. When a CISA advisory drops, the first question the TPRM lead gets is "which of our vendors run this?" — answering in minutes instead of weeks is the capability continuous monitoring is ultimately judged on.
