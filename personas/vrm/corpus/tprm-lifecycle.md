---
title: The TPRM Program Lifecycle and Where Ratings Platforms Plug In
persona: vrm
tags: [tprm, lifecycle, vendor-onboarding, regulation]
sources:
  - title: "OCC Bulletin 2023-17: Interagency Guidance on Third-Party Relationships"
    url: https://www.occ.gov/news-issuances/bulletins/2023/bulletin-2023-17.html
  - title: "Bitsight: Continuous Vendor Monitoring and Fourth-Party Risk for Regulated Industries in 2026"
    url: https://www.bitsight.com/guides/continuous-vendor-monitoring-and-fourth-party-risk-for-regulated-industries-in-2026
  - title: "UpGuard: 15 KPIs & Metrics to Measure the Success of Your TPRM Program"
    url: https://www.upguard.com/blog/kpis-to-measure-tprm
  - title: "Verizon: 2025 Data Breach Investigations Report announcement"
    url: https://www.verizon.com/about/news/2025-data-breach-investigations-report
retrieved_at: "2026-07-19"
---

## The canonical lifecycle

Mature TPRM programs run a five-stage lifecycle: (1) intake, screening, and tiering; (2) due diligence and risk assessment; (3) contracting and risk mitigation; (4) ongoing monitoring and performance management; (5) offboarding and termination. In US banking this is not optional structure — the June 2023 Interagency Guidance (OCC Bulletin 2023-17, jointly with the Federal Reserve and FDIC) frames risk management across the entire third-party relationship lifecycle and expects rigor proportionate to the criticality of each relationship, with ongoing monitoring as a baseline activity, not an annual event.

**Intake and tiering.** Inherent risk is scored from data sensitivity, system/network access, and business criticality before any security review happens. Tier assignment drives everything downstream: which questionnaire (if any), assessment depth, monitoring intensity, reassessment cadence. Ratings platforms plug in here as an instant pre-screen — an outside-in grade on day zero, before the vendor has answered a single question, lets low-risk vendors skip straight to ratings-only oversight.

**Due diligence.** Questionnaires, SOC 2 / ISO 27001 evidence review, financial and sanctions checks. The practitioner move is triangulation: self-reported questionnaire answers validated against externally observed ratings findings. A vendor claiming a hardened patching program while the ratings platform shows end-of-life services on internet-facing hosts is a due-diligence finding in itself.

**Contracting.** Security exhibits encode assessment results: right-to-audit, breach-notification windows, remediation SLAs, sometimes a minimum security rating ("maintain a B or better") as a contractual covenant — which makes the ratings platform the ongoing compliance instrument for that clause.

**Ongoing monitoring.** The stage where ratings platforms carry the most weight, because the alternative is a visibility gap: per Bitsight's 2026 regulated-industries guide, only about one in three organizations continuously monitors all of their third-party relationships; the rest rely on assessment cycles with multi-month blind spots. The urgency is empirical — third-party involvement in breaches doubled from 15% to 30% year-over-year in the 2025 Verizon DBIR.

**Offboarding.** Revoke access, recover/destroy data, confirm disconnection, close obligations. Frequently the weakest stage; ratings data can verify that a terminated vendor no longer exposes shared infrastructure, and UpGuard's KPI list pointedly includes "# of unboarded suppliers still on payroll" as a hygiene metric.

## How the program is measured

Recurring KPI families (UpGuard and industry practice): coverage (% of portfolio with a current assessment — best-in-class programs hit 90–95%; % monitored with threat intelligence; % not monitored at all), speed (mean time to complete initial assessment, mean time to onboard, mean time to action after a risk trigger), quality (% failing initial assessment, false-positive counts from monitoring), and compliance (due-diligence completion rate, outstanding requirements, time between reassessments). Assessment cycle time is a differentiator: best-in-class near 10 days against an industry norm of 30–45.

## Practitioner implications for a ratings platform

The platform must serve every stage, not just monitoring: instant scores at intake, evidence for due-diligence triangulation, exportable reporting for contract covenants and exams, tier-aware alerting in monitoring, and portfolio hygiene views for offboarding. Lifecycle-stage gaps are precisely where a TPRM lead bolts on a competing tool — and where consolidation pitches land.
