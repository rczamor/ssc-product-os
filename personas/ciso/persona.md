---
name: The Enterprise CISO
slug: ciso
created: "2026-07-19"
title: Chief Information Security Officer
company_profile: CISO at Meridian Trust Group, a fictional ~3,200-employee financial-services and insurance-administration firm headquartered in New York with EU operations — regulated under NYDFS Part 500, SEC public-company disclosure rules, and DORA, with roughly 600 third-party vendors under management.
jtbd:
  - Maintain and defend the company's external security rating so customers, insurers, and regulators see a clean posture
  - Translate technical security posture into board- and regulator-ready risk narratives
  - Continuously monitor ~600 vendors and concentrate scarce diligence effort on the critical few
  - Produce defensible evidence for overlapping regulatory regimes (SEC, NYDFS 500, DORA, NIS2)
  - Prioritize remediation with a flat headcount using outside-in risk signal
  - Benchmark posture against industry peers to justify budget and demonstrate progress
  - Reduce cyber-insurance friction and premium growth with demonstrable, third-party-validated posture
kpis:
  - External security rating held at A (90+), with zero unexplained multi-point drops lasting more than 5 business days
  - Mean time to remediate critical externally-visible findings (target < 14 days)
  - Percentage of tier-1 vendors under continuous monitoring with documented escalation (target 100%)
  - Board/audit-committee reporting delivered on cadence with no material restatements
  - NYDFS April 15 certification filed clean; zero reportable regulatory failures
  - Cyber-insurance premium change at renewal vs. market benchmark
  - Time-to-resolution on disputed/false-positive rating findings (target < 5 business days)
---

## Role Context

She runs a 38-person security organization inside a ~3,200-employee regulated financial-services firm. She reports to the CIO with a dotted line to the audit committee, where she has a standing quarterly slot — a structure NYDFS's amended Part 500 effectively mandates, since the CISO must now report annually to the board and timely-report material cyber issues. The company is public, so SEC Item 106 disclosures and the 8-K Item 1.05 materiality clock are hers to feed, jointly with the GC and CFO. EU subsidiaries put DORA's ICT third-party register on her desk too. She has been a SecurityScorecard customer for four years: her own scorecard, a vendor-monitoring portfolio, and the board-reporting module. She did not buy it because she loves outside-in scanning — she bought it because her customers, her insurers, and her board all see these scores whether she participates or not.

## Goals

Keep the company's letter grade at A and be able to explain every dip within a day. Get vendor risk from an annual-questionnaire theater to genuine continuous monitoring of the ~80 vendors that could actually hurt the firm. Turn security reporting into five to seven stable board KPIs with trend lines, not a 40-slide tour of the SOC. Walk into the April 15 NYDFS certification, the 10-K cycle, and the DORA register audit with evidence already assembled. Hold insurance premiums roughly flat at renewal.

## Jobs-to-be-Done (expanded)

- **Defend the score.** Sales tells her deals stall when a prospect's TPRM team pulls the company's scorecard. She treats the external rating like a credit rating: monitored daily, disputes filed fast, drops root-caused before anyone else asks.
- **Feed the board.** Quarterly audit-committee packet: rating trend vs. peer benchmark, top risks, remediation posture, incident readiness. Directors are not technical — only ~5% of boards have a cyber expert (Diligent/Bitsight) — so the A-to-F grade is one of the few artifacts that lands without translation.
- **Tier and monitor vendors.** 600 vendors, 80 critical. Continuous ratings triage which ones get a questionnaire, a call, or a contract clause. DORA and NYDFS both demand ongoing oversight, not point-in-time assessments.
- **Manufacture regulatory evidence.** Every monitoring artifact does double duty: rating history and remediation logs become exhibits for NYDFS, SEC Item 106 narrative, and the DORA register.
- **Prioritize with outside-in signal.** Her vulnerability backlog exceeds her capacity; externally-visible findings correlated with breach likelihood jump the queue.
- **Justify budget.** Peer benchmarking ("we're 15 points above industry median, here's what holding that costs") is her most reliable budget argument.

## Top Pain Points

False positives and misattributed assets — every wrongly-attributed IP costs her analysts hours and her credibility with the board if the score dips on bad data. Score volatility she can't explain before a customer or insurer asks. Vendor fatigue: her own vendors dispute her findings about them, and she disputes findings about herself — the dispute loop is a real operating cost. Questionnaire duplication that ratings were supposed to reduce but haven't fully. Tool sprawl and the pressure to consolidate spend.

## KPIs and How They're Measured

Rating stability is measured off the platform itself: weekly snapshots, drop alerts, dispute-resolution SLAs (SecurityScorecard advertises ~48-hour review and 48–72-hour scorecard updates — she holds it to that). Remediation speed comes from cross-referencing platform findings with her internal VM tooling. Vendor coverage is a simple ratio audited quarterly. Board-reporting quality is judged by the audit-committee chair: on-cadence, trend-based, no restatements. Regulatory KPIs are binary and existential: certification filed, no enforcement contact. Insurance outcome is the renewal delta her CFO sees.

## A Day in the Life

07:30 — scans the overnight alert digest; the company score dropped 3 points on a patching-cadence finding tied to an IP she suspects belongs to a divested business unit. Files a dispute with evidence before standup. 09:00 — TPRM lead flags a critical payments vendor whose grade slid from B to D in three weeks; she triggers the contractual escalation clause. 11:00 — prepares the audit-committee pre-read: rating trend, peer benchmark, top-5 risks. 14:00 — call with the cyber-insurance broker, who has the firm's scorecard open on his screen. 16:00 — reviews DORA register-of-information gaps with EU counsel. 17:30 — a sales engineer forwards a prospect's security review citing the company's public score. She closes the loop on the morning's dispute.

## Evaluation Lens: What "Good" Looks Like in a Security Ratings Platform

Accurate attribution above all — the score is only useful if she never has to caveat it. Fast, evidence-based dispute resolution with honored SLAs. Transparent, documented methodology she can defend to a regulator or a skeptical director. Stable scoring (methodology changes announced, versioned, explainable). Peer benchmarking against a credible cohort. Board-ready exports that need no rework. APIs into her SIEM/GRC so ratings data lands where work happens. Vendor-portfolio workflow that actually replaces questionnaire volume. Evidence trails mapped to NYDFS/DORA/SEC obligations.

## Red Flags That Would Make Them Churn

A score drop caused by the platform's own misattribution that a customer or insurer sees before it's fixed. Dispute SLAs quietly missed. Unannounced methodology changes that swing grades. Findings that her internal tooling proves stale or wrong more than occasionally. Benchmark cohorts that feel arbitrary. Pricing that grows faster than the vendor-portfolio value. Sales pressure to buy modules that duplicate her existing stack. Any sign the vendor's own security posture is weak — a ratings company that can't hold its own A is disqualifying.
