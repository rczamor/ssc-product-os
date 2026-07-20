# SecurityScorecard — customer-feedback themes (scraped 2026-07-20)

Source: 33 real, attributed reviews from public review sites (PeerSpot aggregator,
TrustRadius, G2). Direct headless scraping of Capterra/G2/TrustRadius was
bot-walled (Cloudflare challenge) — see `runs/feedback/scrape.json` `attempts`;
items were recovered via the review-aggregator crawl. Ratings on a 0–5 scale.

Each theme below carries the persona that owns it and a concrete **in-product
validation hypothesis** — what a persona agent should try on the live platform to
confirm, refute, or extend the theme. Agents should also surface issues *not* in
this feedback.

---

## T1 — Score accuracy & entity/domain attribution  ·  CISO + VRM
Public-data-based ratings can be wrong; M&A/portfolio vulnerabilities get
misattributed to the wrong entity.
- "SecurityScorecard started associating other portfolio company vulnerabilities to our score … giving us vulnerabilities we did not have." — IT ops risk analyst, energy (10,001+), 4.0
- "Make sure the algorithm pulls the right data for the right domain." — same
- "The risk score is based on publicly available data and can be inaccurate … do not base your assessment solely on the score." — TrustRadius, InfoSec/compliance
- **Validate:** On own scorecard → Digital Footprint / attribution. Can you see *why* an IP/finding is attributed to you? Is there a way to remove/dispute a wrongly-attributed asset? How many clicks?

## T2 — False positives & self-service refute  ·  CISO / VRM
Volume of false positives with no fast way to refute.
- "Quite a lot of false positives … understand how to quickly fix or report [them], perhaps through a self-checkout feature." — Cybersecurity Specialist (501–1,000), 4.5
- **Validate:** Open a finding/issue → is there a "refute / mark false positive / provide evidence" action? Time-to-refute in clicks. Does it require support?

## T3 — Remediation guidance depth  ·  CISO
Findings are thin on how to actually fix; nothing for non-technical owners; no
compensating-control path.
- "Details on the technical mitigation would help my non-technical teams understand the security issues better." — AppSec engineer, media (51–200), 4.0
- "More detailed remediation guidance …" — SOC analyst, 4.0
- "Ability to mitigate vulnerabilities with alternative solutions." — Sys admin, OnShift
- "Hints on what specifically to look for; sometimes they don't fix your issues." — Administrator, 4.0
- **Validate:** Open an Issue type → inspect remediation instructions. Is there step-by-step guidance, an owner-friendly explanation, an accept-risk/compensating-control flow?

## T4 — Data freshness & rescan cadence  ·  CISO
Data can be days stale; no on-demand rescan; no real-time/constant scanning.
- "The information may be several days old … an automatic scan at any point in time to refresh … would be helpful." — Owner, Taktik (51–200), 3.5
- "Not doing constant scans, real-time scanning was not available." — G2 dislike
- **Validate:** Look for a "rescan now" control on the scorecard; check last-observed / first-seen timestamps on findings. Is refresh self-service or support-gated?

## T5 — Reporting customization & exports  ·  GTM/CS + CISO
Reports limited to predefined formats; board summaries brittle; want custom
export + alert customization.
- "Reports … are limited to predefined formats." — AppSec engineer, 4.0
- "Better reporting and alert customization … more intuitive UI." — SOC analyst, 4.0
- **Validate:** Report Center / board summary → available formats, customization, and whether generation succeeds. (The prior run already hit a "board summary failed fetch" — corroborate.)

## T6 — Questionnaire automation & vendor engagement  ·  VRM
No questionnaire module for some tiers; manual supplier Q&A; Atlas praised where present.
- "They could improve the process with a questionnaire module … we have to answer multiple questions for the suppliers manually." — CEO, Cloudway, 2.5
- (+) "ROI for Atlas electronic questionnaire … reduces vendor due-diligence time." — TrustRadius reseller
- **Validate:** Assessments / questionnaire flow → how much is automated vs manual; can you send/track a questionnaire; evidence collection UX.

## T7 — Active vs passive TPRM & internal monitoring  ·  VRM + CISO
Passive-only; no levers to drive vendor remediation; only public-facing assets.
- "More active rather than passive third-party risk management features to truly mitigate risks." — Regional Director, 3.5
- "Customer devices that are not only public-facing can be monitored." — Pre-Sales lead, 5.0
- "You do not have control over another company's risk." — Owner, Taktik, 3.5
- **Validate:** Vendor portfolio → what actions can you drive on a vendor (request, remediation plan, outreach)? Any internal/non-public monitoring option?

## T8 — Support responsiveness  ·  GTM/CS
Slow technical support; under-resourced for customer volume.
- "Technical team's response time … three days is way too much." — EVP Technology, InfoEdge
- "Response times and overall support … better organization to support their customer volume." — Regional Director, 3.5
- **Validate (contextual):** In-app help/support surfaces, SLA visibility, self-serve docs from within the product.

## T9 — Pricing & tiering  ·  GTM/CS
Steep jump to paid; no low tier for small orgs; regional payment friction.
- "The pricing gap to the paid version feels steep for small organizations." — Administrator, 4.0
- "Expected slightly lower pricing [SaaS-first]." — AppSec engineer, 4.0
- "Pricing … needs improvement in Brazil [wire transfers, high taxes]." — Owner, Sunlit
- **Validate (contextual):** Not in-product; note upgrade/marketplace surfaces that gate features behind tiers.

## T10 — Ratings explainability & methodology transparency  ·  CISO
Scanning methodology/privacy opaque; want AI-explained rating rationale.
- "Give a little more specifics on how the scanning works … more details on the privacy side." — Cybersecurity Specialist, 4.5
- "Suggestions from the AI tool regarding why SecurityScorecard rates specific issues." — AppSec engineer, 4.0
- **Validate:** Score Factors → is the "why this score" explained per factor? Any AI/explain affordance? Score Planner / improve-score plan usefulness.

---

## Persona → themes to validate
- **CISO (self-monitoring, score defense):** T1, T2, T3, T4, T10 (+ T5 board reporting)
- **VRM (third-party risk):** T1, T2, T6, T7 (+ T5)
- **GTM/CS (demo, adoption, renewal):** T5, T8, T9, plus demo/adoption surfaces

## Positive anchors (for the "3 likes" side of the deliverable)
- Enterprise-ready TPRM automation (Cloudway CEO); Atlas questionnaire ROI (reseller)
- "Automated approach — nothing is missed on the IPs your org is related to." (Administrator)
- Fast initial setup (EVP, InfoEdge, 9/10); clear external vulnerability visibility (OnShift)
- "Easy to find issues, solve false positives, track ratings." (InfoSec/compliance mgr)
