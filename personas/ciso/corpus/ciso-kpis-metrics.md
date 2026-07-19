---
title: The Metrics Practice of Modern CISOs
persona: ciso
tags: [metrics, kpis, risk-quantification]
sources:
  - title: "IBM Cost of a Data Breach Report 2025"
    url: https://www.ibm.com/reports/data-breach
  - title: "SecurityScorecard: 20 Cybersecurity Metrics & KPIs to Track"
    url: https://securityscorecard.com/blog/9-cybersecurity-metrics-kpis-to-track/
  - title: "Safe Security: Key Risk Indicators for Cyber Risk Quantification"
    url: https://safe.security/resources/blog/key-risk-indicators-for-cyber-risk-quantification-examples-cisos-actually-use/
  - title: "UpGuard: Top Cybersecurity Metrics and KPIs"
    url: https://www.upguard.com/blog/cybersecurity-metrics
retrieved_at: "2026-07-19"
---

## The anchor numbers CISOs benchmark against

IBM's Cost of a Data Breach 2025 report sets the reference points a metrics program is judged by: global average breach cost fell 9% to $4.44M, but the US average hit a record $10.22M. Mean time to identify and contain a breach dropped to 241 days — a nine-year low — and the 200-day mark functions as a cost cliff: breaches contained under 200 days averaged $3.87M vs. $5.01M above it (a 24% premium). Organizations with extensive AI/automation in security operations shortened the breach lifecycle by ~68 days and saved ~$1.9M per breach. CISOs quote these numbers in budget asks because they convert speed metrics into dollars.

## KPI vs. KRI: the load-bearing distinction

Mature programs separate performance indicators from risk indicators (Safe Security). KPIs measure execution of the program: % of systems scanned, mean time to deploy patches, phishing-simulation failure rates, control coverage. KRIs measure exposure: count of exploitable vulnerabilities on critical assets, number of vendors with sensitive-data access and poor security posture, MTTD/MTTC. KRIs feed cyber risk quantification — increasingly through FAIR (Factor Analysis of Information Risk), where detection/containment speed drives loss magnitude, letting a CISO express risk as a loss-exceedance figure rather than a heat map. Boards get KRIs and quantified exposure; ops reviews get KPIs.

## The standard operating set

Across practitioner guidance (SecurityScorecard, UpGuard), the recurring core set is: MTTD and MTTR (with resolution vs. full-recovery distinguished), vulnerability remediation time by severity tier, patching cadence, incident counts and severity mix, phishing/social-engineering test results, access-control hygiene (privileged accounts, MFA coverage), third-party/vendor posture, and security rating trend. The discipline that separates good programs isn't metric selection — it's stability (same metrics quarter over quarter so trends mean something) and thresholds (every metric has a target and an escalation trigger, not just a value).

## Where external security ratings fit

Ratings occupy a specific niche in the stack: they are the only widely-recognized *outside-in* KRI — measured the way an attacker, insurer, customer, or plaintiff sees the organization, on a continuous basis, comparable across companies. SecurityScorecard's own claim that F-rated companies are 13.8x more likely to be breached than A-rated ones is the canonical version of the ratings-as-KRI argument. Practically, CISOs use the rating three ways: as a trend line in the board dashboard (it's the one metric directors can compare to peers), as an independent check on internal metrics (if internal patch KPIs look green but the external patching-cadence factor is red, the internal telemetry has a coverage gap), and as the exposure metric for the vendor portfolio where no internal telemetry exists at all.

## Failure modes CISOs watch for

Vanity metrics (blocked-attack counts), metrics without denominators (patches applied vs. patch coverage of the estate), and externally-visible metrics that contradict internal ones. The last is the sharpest: a CISO whose internal dashboard says "strong patching" while the public rating shows failing patching cadence has a credibility problem with the board and a discoverable inconsistency in litigation. This makes accuracy and freshness of the ratings feed a first-order requirement, not a nice-to-have.
