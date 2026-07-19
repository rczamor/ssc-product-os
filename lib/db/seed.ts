import type { Db } from "./index";
import { deliverables, findings, personaEvaluations, runRequests, runs, screenshots } from "./schema";

/** 1x1 white JPEG — placeholder screenshot bytes for seeded demo data. */
const TINY_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
  "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy" +
  "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA" +
  "AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA" +
  "AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3" +
  "ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm" +
  "p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMB" +
  "AAIRAxEAPwD3+iiigD//2Q==";

/**
 * Demo content so the UI has something to show before any live run has been
 * published (fresh PGlite in e2e, or a deployed app with no DATABASE_URL yet).
 * Skips itself if any run already exists.
 */
export async function seed(db: Db): Promise<void> {
  const existing = await db.select({ id: runs.id }).from(runs).limit(1);
  if (existing.length > 0) return;

  const [run] = await db
    .insert(runs)
    .values({
      status: "completed",
      trigger: "slash",
      personas: ["ciso", "vrm", "gtm_cs"],
      finishedAt: new Date(),
    })
    .returning();

  const shotData = Buffer.from(TINY_JPEG_BASE64, "base64");
  const [shot] = await db
    .insert(screenshots)
    .values({
      runId: run.id,
      persona: "ciso",
      label: "demo-dashboard",
      urlVisited: "https://platform.securityscorecard.io/",
      data: shotData,
      width: 1,
      height: 1,
    })
    .returning({ id: screenshots.id });

  const personaSeed = [
    {
      persona: "ciso",
      summary:
        "Seeded demo evaluation. The scorecard's A-F letter grade is instantly board-legible, but factor drill-downs bury the 'so what' — this row exists so the UI renders before the first live run is published.",
      like: {
        key: "board-legible-grade",
        kind: "like",
        title: "A-F letter grade is instantly board-legible",
        detail:
          "Seeded demo finding: the letter grade maps security posture to a format a board understands without translation, which shortens report prep.",
        whyItWorks: "Boards understand letter grades without a methodology lecture.",
        jtbd: "Report security posture to the board",
        screenshotLabels: ["demo-dashboard"],
      },
      dislike: {
        key: "factor-drilldown-so-what",
        kind: "dislike",
        title: "Factor drill-down buries the 'so what'",
        detail:
          "Seeded demo finding: clicking into a factor shows raw issue lists with little prioritization, so translating findings into an action plan takes manual work.",
        customerPain: "I can see issues but not which three things to fix first.",
        jtbd: "Turn score changes into a prioritized remediation plan",
        rootCause: "ux",
        effort: "M",
        firstAction: "Add a 'top 3 score drivers' summary to each factor page.",
        severity: 3,
      },
    },
    {
      persona: "vrm",
      summary:
        "Seeded demo evaluation. Portfolio views make triage workable, but questionnaire and rating workflows feel disconnected — this row exists so the UI renders before the first live run is published.",
      like: {
        key: "portfolio-triage",
        kind: "like",
        title: "Portfolio view supports fast vendor triage",
        detail:
          "Seeded demo finding: sortable portfolio grades let a vendor risk manager scan hundreds of vendors and spot degradations quickly during weekly review.",
        whyItWorks: "One screen answers 'which vendors moved this week'.",
        jtbd: "Continuously monitor the vendor portfolio",
        screenshotLabels: [],
      },
      dislike: {
        key: "questionnaire-rating-silo",
        kind: "dislike",
        title: "Questionnaires feel siloed from ratings",
        detail:
          "Seeded demo finding: questionnaire responses and the outside-in rating live in separate surfaces with no combined risk view, forcing manual correlation.",
        customerPain: "I reconcile questionnaire answers against scores by hand in a spreadsheet.",
        jtbd: "Combine point-in-time assessment with continuous monitoring",
        rootCause: "workflow",
        effort: "L",
        firstAction: "Prototype a unified vendor risk summary combining both signals.",
        severity: 4,
      },
    },
    {
      persona: "gtm_cs",
      summary:
        "Seeded demo evaluation. Prospect scorecards are a strong sales artifact, but score-dispute handling creates awkward customer conversations — this row exists so the UI renders before the first live run is published.",
      like: {
        key: "prospect-scorecard-hook",
        kind: "like",
        title: "Prospect scorecard is a strong conversation opener",
        detail:
          "Seeded demo finding: pulling up any company's scorecard live in a first meeting demonstrates value in under a minute and anchors the conversation in data.",
        whyItWorks: "Instant, personalized value demo with zero setup.",
        jtbd: "Demonstrate platform value in the first meeting",
        screenshotLabels: [],
      },
      dislike: {
        key: "dispute-flow-friction",
        kind: "dislike",
        title: "Score dispute flow is hard to walk customers through",
        detail:
          "Seeded demo finding: when a customer contests a finding, the resolution path is multi-step and slow to demonstrate, which turns QBRs into support calls.",
        customerPain: "My QBR derails into 'why is this IP attributed to us' for 30 minutes.",
        jtbd: "Keep renewal conversations focused on value, not disputes",
        rootCause: "workflow",
        effort: "M",
        firstAction: "Map the current dispute journey and count the steps to resolution.",
        severity: 3,
      },
    },
  ] as const;

  for (const p of personaSeed) {
    await db.insert(personaEvaluations).values({
      runId: run.id,
      persona: p.persona,
      status: "completed",
      summary: p.summary,
      journey: [{ label: "demo-dashboard", url: "https://platform.securityscorecard.io/" }],
      rawOutput: { persona: p.persona, summary: p.summary, likes: [p.like], dislikes: [p.dislike] },
      finishedAt: new Date(),
    });
    await db.insert(findings).values([
      {
        runId: run.id,
        persona: p.persona,
        key: p.like.key,
        kind: "like",
        title: p.like.title,
        detail: p.like.detail,
        jtbd: p.like.jtbd,
        raw: p.like,
        screenshotIds: p.persona === "ciso" ? [shot.id] : [],
      },
      {
        runId: run.id,
        persona: p.persona,
        key: p.dislike.key,
        kind: "dislike",
        title: p.dislike.title,
        detail: p.dislike.detail,
        customerPain: p.dislike.customerPain,
        jtbd: p.dislike.jtbd,
        rootCause: p.dislike.rootCause,
        effort: p.dislike.effort,
        firstAction: p.dislike.firstAction,
        severity: p.dislike.severity,
        raw: p.dislike,
      },
    ]);
  }

  const kfd = [
    {
      item: "Factor pages without prioritization",
      verdict: "fix",
      customerPain: "Issue lists without ranking leave teams guessing what to fix first.",
      personas: ["ciso"],
      rootCause: "ux",
      effort: "M",
      firstAction: "Add a 'top 3 score drivers' summary to each factor page.",
      sourceFindingKeys: ["factor-drilldown-so-what"],
    },
    {
      item: "Questionnaire/rating silo",
      verdict: "fix",
      customerPain: "Manual correlation between questionnaires and ratings wastes analyst hours.",
      personas: ["vrm"],
      rootCause: "workflow",
      effort: "L",
      firstAction: "Prototype a unified vendor risk summary combining both signals.",
      sourceFindingKeys: ["questionnaire-rating-silo"],
    },
    {
      item: "Score dispute journey",
      verdict: "fix",
      customerPain: "Slow dispute resolution erodes trust in the score itself.",
      personas: ["gtm_cs", "ciso"],
      rootCause: "workflow",
      effort: "M",
      firstAction: "Map the current dispute journey and count the steps to resolution.",
      sourceFindingKeys: ["dispute-flow-friction"],
    },
    {
      item: "Portfolio triage view",
      verdict: "double_down",
      customerPain: "Weekly vendor review is the VRM's core loop; make it even faster.",
      personas: ["vrm"],
      rootCause: "strategy",
      effort: "S",
      firstAction: "Add saved views and change-since-last-review filters.",
      sourceFindingKeys: ["portfolio-triage"],
    },
    {
      item: "Prospect scorecard demo flow",
      verdict: "double_down",
      customerPain: "The fastest path to demonstrating value in sales conversations.",
      personas: ["gtm_cs"],
      rootCause: "strategy",
      effort: "S",
      firstAction: "Package a one-click 'first meeting' demo view for sales.",
      sourceFindingKeys: ["prospect-scorecard-hook"],
    },
  ];

  await db.insert(deliverables).values({
    runId: run.id,
    likes: [
      {
        title: "Board-legible A-F grading",
        detail:
          "Seeded demo: the letter-grade system translates technical posture into an executive-ready format across personas.",
        personas: ["ciso"],
        sourceFindingKeys: ["board-legible-grade"],
      },
      {
        title: "Portfolio-scale vendor triage",
        detail:
          "Seeded demo: portfolio views make continuous monitoring of hundreds of vendors a one-screen weekly workflow.",
        personas: ["vrm"],
        sourceFindingKeys: ["portfolio-triage"],
      },
      {
        title: "Instant prospect scorecards",
        detail:
          "Seeded demo: live scorecard lookup is a zero-setup value demonstration in any customer or prospect meeting.",
        personas: ["gtm_cs"],
        sourceFindingKeys: ["prospect-scorecard-hook"],
      },
    ],
    dislikes: [
      {
        title: "Factor drill-downs lack prioritization",
        detail: "Seeded demo dislike 1 — see finding factor-drilldown-so-what.",
        personas: ["ciso"],
        customerPain: "Issue lists without ranking leave teams guessing what to fix first.",
        rootCause: "ux",
        effort: "M",
        firstAction: "Add a 'top 3 score drivers' summary to each factor page.",
        sourceFindingKeys: ["factor-drilldown-so-what"],
      },
      {
        title: "Questionnaires siloed from ratings",
        detail: "Seeded demo dislike 2 — see finding questionnaire-rating-silo.",
        personas: ["vrm"],
        customerPain: "Manual correlation between questionnaires and ratings wastes analyst hours.",
        rootCause: "workflow",
        effort: "L",
        firstAction: "Prototype a unified vendor risk summary combining both signals.",
        sourceFindingKeys: ["questionnaire-rating-silo"],
      },
      {
        title: "Dispute flow derails customer conversations",
        detail: "Seeded demo dislike 3 — see finding dispute-flow-friction.",
        personas: ["gtm_cs"],
        customerPain: "QBRs turn into attribution-dispute support calls.",
        rootCause: "workflow",
        effort: "M",
        firstAction: "Map the current dispute journey and count the steps to resolution.",
        sourceFindingKeys: ["dispute-flow-friction"],
      },
      {
        title: "Demo dislike four (seeded)",
        detail: "Seeded demo dislike 4 — placeholder so the deliverable has the required five entries.",
        personas: ["ciso"],
        customerPain: "Placeholder pain entry for seeded demo data.",
        rootCause: "data",
        effort: "S",
        firstAction: "Replaced by the first live evaluation run.",
        sourceFindingKeys: [],
      },
      {
        title: "Demo dislike five (seeded)",
        detail: "Seeded demo dislike 5 — placeholder so the deliverable has the required five entries.",
        personas: ["vrm"],
        customerPain: "Placeholder pain entry for seeded demo data.",
        rootCause: "packaging",
        effort: "S",
        firstAction: "Replaced by the first live evaluation run.",
        sourceFindingKeys: [],
      },
    ],
    kfdTable: kfd,
    markdown:
      "# Platform Review (seeded demo)\n\nThis is seeded demo content shown until the first live persona evaluation run is published.",
  });

  await db.insert(runRequests).values({
    status: "completed",
    personas: ["ciso", "vrm", "gtm_cs"],
    note: "Seeded demo request",
    requestedBy: "seed",
    runId: run.id,
    claimedAt: new Date(),
  });
}
