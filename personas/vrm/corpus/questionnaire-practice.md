---
title: "Security Questionnaire Reality: SIG, CAIQ, Fatigue, and Automation"
persona: vrm
tags: [questionnaires, sig, caiq, assessment-automation]
sources:
  - title: "Workstreet: SIG Lite Explained — A Complete Guide for 2026"
    url: https://www.workstreet.com/blog/sig-lite
  - title: "Mitratech: SIG 2026 — Key Updates and Considerations"
    url: https://mitratech.com/resource-hub/blog/sig-2026-key-updates-and-considerations/
  - title: "Cloud Security Alliance: STAR Level 1 Security Questionnaire (CAIQ v4)"
    url: https://cloudsecurityalliance.org/artifacts/star-level-1-security-questionnaire-caiq-v4
  - title: "Steerlab: Security Questionnaire Fatigue — Stats & How to Fix It"
    url: https://www.steerlab.ai/blog/security-questionnaire-fatigue
  - title: "Panorays: Vendor Security Questionnaire Fatigue"
    url: https://panorays.com/blog/vendor-security-questionnaire-fatigue/
retrieved_at: "2026-07-19"
---

## The standard instruments

**SIG (Shared Assessments).** The de facto TPRM questionnaire standard. Per Workstreet's guide, SIG Lite runs 126–128 questions (a few hours for a prepared vendor) and is used for low-risk vendors and first-pass screening; SIG Core scales up to 855 questions across 19 risk domains and can take a vendor days with multiple stakeholders. The 2026 SIG release (per Mitratech) added comprehensive ISO 42001 mapping for AI governance across the AI lifecycle, integrated the Business Resilience Council's Operational Resilience Framework, enhanced NIST SP 800-171 mapping, and formalized Lite/Core/Detail scoping presets — plus "SIG EV," a cloud platform intended to replace the Excel workbook workflow. Practical read: AI governance and operational resilience are now standard due-diligence content, not custom add-ons.

**CAIQ (Cloud Security Alliance).** CAIQ v4 is 261 yes/no questions mapped to the Cloud Controls Matrix v4 (197 control objectives, 17 domains). A completed CAIQ can be published to CSA's STAR Registry as a Level 1 self-assessment — meaning for many cloud vendors, the answers already exist publicly and re-asking them is pure waste.

## The fatigue problem (both directions)

Steerlab's compilation of industry estimates: a manual questionnaire response takes 10–40 hours; an 80–100 question assessment costs a prepared team roughly a day, while a 400+ question DDQ consumes an engineer-week. Volume compounds it — mid-market vendors field 50–100 questionnaires a year, large enterprise vendors several hundred, often on turnaround windows of five business days or less. Panorays identifies the causes as lack of standardization (custom forms asking the same questions in slightly different formats), manual copy-paste processes, and overlapping requests — with real consequences: degraded answer accuracy, resentful vendor relationships, and slower deals. The buyer side hurts symmetrically: an assessor team of four cannot deep-review hundreds of vendors a year, so unscoped, oversized questionnaires directly reduce portfolio coverage.

## What good practice looks like now

- **Risk-proportionate scoping:** SIG Lite or ratings-only review for low tiers, SIG Core reserved for vendors touching regulated data. The 2026 SIG's scoping presets institutionalize this.
- **Evidence over attestation:** self-reported answers are directionally useful but unverified; mature programs triangulate against outside-in ratings findings and certification artifacts (SOC 2, ISO, STAR entries) rather than accepting "Yes" at face value.
- **Reuse before re-ask:** check STAR Registry / shared-assessment exchanges before issuing anything.
- **AI on both sides of the table:** vendors increasingly use AI response tools to draft answers from prior questionnaires; assessors use AI to flag contradictions between answers and observed evidence. Net effect — the differentiating skill shifts from *answering* questionnaires to *validating* them.

## Implication for a ratings platform

A ratings platform earns its seat in questionnaire practice by shrinking it: pre-filled or exchange-sourced answers, automated cross-checks of claims against scan findings, and scoping recommendations by tier. If the platform's questionnaire module is a mail-merge form builder with no evidence linkage, the TPRM lead will keep a separate assessment-automation tool — and resent paying for both.
