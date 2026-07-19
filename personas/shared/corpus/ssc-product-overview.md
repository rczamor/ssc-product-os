---
title: SecurityScorecard Product Overview
persona: shared
tags: [product, security-ratings, tprm]
sources:
  - title: SecurityScorecard 10 Risk Factors Explained (SecurityScorecard blog)
    url: https://securityscorecard.com/blog/securityscorecard-10-risk-factors-explained/
  - title: How SecurityScorecard calculates your scores (Help Center)
    url: https://support.securityscorecard.com/hc/en-us/articles/8366223642651-How-SecurityScorecard-calculates-your-scores
  - title: SecurityScorecard Pricing
    url: https://securityscorecard.com/pricing/
  - title: SecurityScorecard Acquires HyperComply (press release)
    url: https://securityscorecard.com/company/press/securityscorecard-acquires-hypercomply-to-bring-ai-powered-automation-to-supply-chain-risk-management/
  - title: SecurityScorecard Acquires Driftnet (Business Wire)
    url: https://www.businesswire.com/news/home/20260514216791/en/SecurityScorecard-Acquires-Driftnet-to-Power-Real-Time-Threat-Informed-Third-Party-Risk-Management
retrieved_at: "2026-07-19"
---

# SecurityScorecard: Product Overview

SecurityScorecard (founded late 2013 by former CISOs Aleksandr Yampolskiy and Sam Kassoumeh, HQ New York) is a security ratings and third-party risk platform. It continuously scans internet-facing assets and assigns organizations a letter grade without their participation. The company has cited "over 1.5 million organizations" actively rated in scoring documentation, while marketing materials cite 12M+ total rated entities — treat exact counts as fluid (unverified).

## Rating model

- Grades run A–F on a 0–100 numeric scale. SecurityScorecard claims an F-rated organization (score ≤60) is 13.8x more likely to suffer a breach than an A (90–100) — a vendor-published statistic (SecurityScorecard Help Center / blog).
- Findings roll up into 10 factor categories: Network Security (open ports, weak TLS/ciphers), DNS Health, Patching Cadence (remediation speed vs. peers), Endpoint Security, IP Reputation (malware/botnet signals from sinkhole data), Application Security, Cubit Score (proprietary checks for exposed admin interfaces and similar misconfigurations), Hacker Chatter (dark-web/underground mentions), Information Leak (leaked credentials), and Social Engineering (per the "10 Risk Factors Explained" blog).
- Scoring 3.0 (effective April 9, 2024): the total score is computed directly from 200+ weighted "issue types" and finding volume, weighted by "Breach Risk," rather than the earlier weighted average of the 10 factor scores. Factor grades are still displayed on scorecards (Help Center).
- SecurityScorecard runs periodic scoring recalibrations that reweight issue types (documented recalibrations: Oct 21, 2025; Feb 18, 2026; one announced for May 20, 2026), which can move scores with no change in the rated company's posture (Help Center).

## Modules and acquisitions

- **Atlas / Questionnaires**: Atlas launched Feb 2019 as a questionnaire and evidence-exchange platform; its functionality now lives in the platform as the Questionnaires tool.
- **HyperComply (acquired Sept 15, 2025)**: AI questionnaire-response automation ("RespondAI") and trust portals; company claims 92% reduction in questionnaire workload and 10x faster vendor onboarding (press release; vendor claims).
- **MAX**: fully managed "Supply Chain Detection and Response" (SCDR) service — SecurityScorecard staff/partners engage vendors, run threat hunting, and drive remediation on the customer's behalf.
- **Attack Surface Intelligence / TITAN AI**: internet-wide scanning and threat-intel product (port-agnostic service detection, JARM fingerprinting of C2 infrastructure; claims re-verification of 3,500+ ports every three days) for TPRM teams and threat hunters (product page).
- **Automatic Vendor Detection (AVD)**: paid add-on that auto-discovers third- and fourth-party vendor relationships from observed technology/connections.
- **Driftnet (acquired May 14, 2026 — verified)**: UK internet-scanning startup folded into the TITAN AI platform; SecurityScorecard claims it can now index 40% more internet-exposed hosts than any rival provider (company claim; Business Wire).
- SecurityScorecard also positions the whole platform under the SCDR category banner, an attempt to reframe TPRM as an operational detection/response discipline. Earlier acquisition of DFIR firm LIFARS in 2022 (unverified in this research pass).

## Pricing and packaging shape

Per the pricing page: a free-forever tier (own scorecard, digital footprint management, self-monitoring dashboard, basic alerts, questionnaire response); paid tiers currently packaged as TITAN Watch Core / Premium / Elite, priced by the number of monitored organizations (custom quotes only — no public prices). Add-ons include TITAN Assess (AI questionnaire automation), TITAN Secure, Cyber Risk Quantification, AVD, and MAX managed services. The free tier is a deliberate land-and-expand motion: any company can claim and dispute its own scorecard at no cost.

## Platform surfaces

Day-to-day surfaces: scorecard detail pages (grade, factor breakdown, issue-level findings with evidence), portfolios for grouping and watching vendor sets, configurable score-change/issue alerts, reporting (board-ready and comparison reports), plus APIs and marketplace integrations (Help Center; pricing page).
