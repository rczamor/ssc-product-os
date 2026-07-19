---
name: persona-eval
description: Methodology and output contract for evaluating the SecurityScorecard platform through a persona lens (CISO, VRM, GTM/CS). Use when producing persona findings.json files, when synthesizing the Prompt-1 deliverable, or when judging finding quality. Defines the JSON schemas, the quality bar, and the judge rubric.
---

# Persona evaluation methodology

## Grounding (read BEFORE browsing)

1. `personas/<slug>/persona.md` — who you are: JTBD, KPIs, pains, evaluation lens.
2. `personas/<slug>/corpus/*.md` — domain research backing your lens.
3. `personas/shared/corpus/*.md` — product facts, competitor context, and the
   documented criticisms of security ratings (sharpen your dislike detection
   with `ratings-industry-criticism.md`).

Your credibility comes from grounding: every finding must tie to a JTBD or KPI
from your persona.md, and product observations should be consistent with the
shared corpus.

## Evaluation loop

1. Scripted coverage: run your journey (`runner/journey.ts`), then Read every
   `*.snapshot.txt` and look at every `*.jpg` under `runs/<id>/<persona>/`.
2. Deviate: for anything confusing, broken, impressive, or suspicious, go
   interactive with ssc-browse (`goto`, `click`, `snapshot`, `screenshot`).
   Spend most of your time here — the journey is the floor, not the ceiling.
3. Judge like the persona, not like a QA bot: "would this help me pass my
   audit / clear my queue / win my renewal?" — not "the button is misaligned".
4. Evidence: capture a screenshot for every finding you can; reference labels
   in `screenshotLabels`.

## Output contract — runs/<id>/<persona>/findings.json

Must parse against `PersonaOutputSchema` in `lib/schemas/findings.ts`. Shape:

```jsonc
{
  "persona": "ciso",                    // your slug: ciso | vrm | gtm_cs
  "summary": "≥80 chars overall impression through the persona lens",
  "likes": [                            // ≥2 — real strengths, not flattery
    {
      "key": "board-legible-grade",     // lowercase slug, unique in this file
      "kind": "like",
      "title": "8–160 chars",
      "detail": "≥40 chars: WHAT you observed, WHERE (route/page), WHY it matters",
      "whyItWorks": "≥20 chars, in the persona's words",
      "jtbd": "the JTBD/KPI from persona.md this supports",
      "screenshotLabels": ["my-scorecard"]
    }
  ],
  "dislikes": [                         // ≥3 — each must name the JTBD it blocks
    {
      "key": "issues-no-prioritization",
      "kind": "dislike",
      "title": "…",
      "detail": "≥40 chars, concrete and observable",
      "customerPain": "≥20 chars, phrased as the persona would say it",
      "jtbd": "the JTBD/KPI from persona.md this blocks",
      "rootCause": "ux | data | workflow | packaging | strategy",
      "effort": "S | M | L",
      "firstAction": "≥10 chars — something a team could start Monday",
      "severity": 1-5,
      "screenshotLabels": ["score-issues"]
    }
  ],
  "journeyNotes": [ { "label": "...", "url": "...", "note": "..." } ]
}
```

Validate until it passes (fix and re-run on SCHEMA INVALID):

```bash
set -a; . ./.env.local; set +a; npx tsx runner/publish.ts --run <id> --persona <p> --validate-only
```

## Root cause taxonomy

- **ux** — findable/understandable/usable problems in the interface
- **data** — accuracy, freshness, attribution, coverage of the underlying data
- **workflow** — the product doesn't match how the persona's work actually flows end-to-end
- **packaging** — right capability, wrong tiering/bundling/naming/discoverability across plans
- **strategy** — the product is optimizing for the wrong thing for this persona

## Deliverable synthesis (synthesizer agent)

`runs/<id>/deliverable.json` per `DeliverableSchema`: exactly **3 likes**,
exactly **5 dislikes**, **≥5 Kill/Fix/Double-Down rows** (each with verdict,
customerPain, personas, rootCause, effort, firstAction, sourceFindingKeys).
Merge duplicates across personas (cite all impacted personas), prefer findings
with evidence and cross-persona corroboration, keep the persona's voice in
customerPain. Kill = actively harming trust/velocity; Fix = valuable but
broken/hidden; Double Down = working strength worth compounding.

## Judge rubric (ssc-finding-judge) — runs/<id>/scores.json

Score every finding (likes and dislikes) 1–5 on both axes:

- **specificity** — 5: names the exact surface, observable behavior, and
  persona consequence, with screenshot evidence; 3: real but generic ("reports
  could be better"); 1: could have been written without opening the product.
- **actionability** — 5: firstAction is concrete, this-week-sized, and
  root-cause-aligned; 3: directionally useful; 1: vague ("improve UX").

```jsonc
{ "scores": [ { "persona": "ciso", "key": "issues-no-prioritization",
                "specificity": 4, "actionability": 5, "comment": "…" } ] }
```
