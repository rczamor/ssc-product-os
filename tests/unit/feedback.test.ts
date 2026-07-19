import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  FeedbackFileSchema,
  FeedbackItemSchema,
  feedbackDedupeKey,
  guessPersona,
} from "@/lib/schemas/feedback";
import { clusterThemes } from "@/lib/feedback-themes";
import type { FeedbackRow } from "@/lib/db/queries";

describe("guessPersona", () => {
  it("maps security leadership roles to ciso", () => {
    expect(guessPersona("Chief Information Security Officer")).toBe("ciso");
    expect(guessPersona("VP of Security")).toBe("ciso");
    expect(guessPersona("Head of Security")).toBe("ciso");
  });

  it("maps vendor/third-party/procurement roles to vrm", () => {
    expect(guessPersona("Third Party Risk Manager")).toBe("vrm");
    expect(guessPersona("Vendor Risk Management Lead")).toBe("vrm");
    expect(guessPersona("Procurement and Supplier Risk Manager")).toBe("vrm");
  });

  it("maps go-to-market/CS roles to gtm_cs", () => {
    expect(guessPersona("Customer Success Manager")).toBe("gtm_cs");
    expect(guessPersona("Sales Engineer")).toBe("gtm_cs");
    expect(guessPersona("Account Executive")).toBe("gtm_cs");
  });

  it("returns null for empty or ambiguous roles", () => {
    expect(guessPersona(null)).toBeNull();
    expect(guessPersona("")).toBeNull();
    expect(guessPersona("Software Developer")).toBeNull();
  });

  it("routes security-office roles to ciso even when 'compliance'/'risk' appear", () => {
    // 'compliance' also matches the vrm branch — ciso must win for security roles.
    expect(guessPersona("Security Compliance Officer")).toBe("ciso");
    expect(guessPersona("Director of Cyber Risk")).toBe("ciso");
    expect(guessPersona("Information Security Manager")).toBe("ciso");
  });
});

describe("feedbackDedupeKey", () => {
  it("prefers the source URL when present", () => {
    const key = feedbackDedupeKey(
      FeedbackItemSchema.parse({
        source: "g2",
        sourceUrl: "https://www.g2.com/products/x/reviews/1",
        body: "A sufficiently long review body for the test.",
      }),
    );
    expect(key).toBe("https://www.g2.com/products/x/reviews/1");
  });

  it("is stable and content-derived when no URL is present", () => {
    const item = FeedbackItemSchema.parse({
      source: "capterra",
      title: "Great tool",
      body: "This is a stable review body used to derive the hash key.",
    });
    const a = feedbackDedupeKey(item);
    const b = feedbackDedupeKey(item);
    expect(a).toBe(b);
    expect(a.startsWith("capterra:")).toBe(true);
  });

  it("differs for different bodies", () => {
    const base = { source: "g2" as const };
    const a = feedbackDedupeKey(
      FeedbackItemSchema.parse({ ...base, body: "First review body, long enough." }),
    );
    const c = feedbackDedupeKey(
      FeedbackItemSchema.parse({ ...base, body: "Second review body, also long enough." }),
    );
    expect(a).not.toBe(c);
  });
});

describe("FeedbackFileSchema", () => {
  it("validates the committed demo corpus (>=30 items)", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data", "feedback-seed.json"), "utf8"),
    );
    const parsed = FeedbackFileSchema.parse(raw);
    expect(parsed.items.length).toBeGreaterThanOrEqual(30);
  });

  it("rejects an empty items array", () => {
    expect(FeedbackFileSchema.safeParse({ items: [] }).success).toBe(false);
  });
});

describe("clusterThemes", () => {
  const rows: FeedbackRow[] = [
    {
      id: "1",
      source: "g2",
      sourceUrl: null,
      reviewDate: null,
      rating: 2,
      title: "Score volatility",
      body: "Our grade dropped with no clear explanation and the lag was weeks.",
      reviewerRoleRaw: "CISO",
      personaGuess: "ciso",
      scrapedAt: new Date(),
    },
    {
      id: "2",
      source: "capterra",
      sourceUrl: null,
      reviewDate: null,
      rating: 3,
      title: "Questionnaire pain",
      body: "The questionnaire workflow and portfolio import are manual for our TPRM team.",
      reviewerRoleRaw: "Vendor Risk Manager",
      personaGuess: "vrm",
      scrapedAt: new Date(),
    },
  ];

  it("returns themes with counts, affinity, and samples", () => {
    const themes = clusterThemes(rows);
    expect(themes.length).toBeGreaterThan(0);
    const volatility = themes.find((t) => t.key === "score-volatility");
    expect(volatility?.count).toBe(1);
    expect(volatility?.personaAffinity).toBe("ciso");
    expect(volatility?.sampleIds).toContain("1");
    const workflow = themes.find((t) => t.key === "questionnaire-portfolio");
    expect(workflow?.personaAffinity).toBe("vrm");
  });

  it("omits themes with no matches", () => {
    const themes = clusterThemes([]);
    expect(themes).toEqual([]);
  });

  it("does not tag 'onboarding'/'dashboard' into the board-reporting theme", () => {
    const rows: FeedbackRow[] = [
      {
        id: "x",
        source: "capterra",
        sourceUrl: null,
        reviewDate: null,
        rating: 4,
        title: "Steep learning curve",
        body: "The initial onboarding was heavier than expected and the dashboard took getting used to.",
        reviewerRoleRaw: "Security Engineer",
        personaGuess: "ciso",
        scrapedAt: new Date(),
      },
    ];
    const themes = clusterThemes(rows);
    expect(themes.find((t) => t.key === "reporting-value")).toBeUndefined();
  });

  it("tags an item into multiple themes when it touches several topics", () => {
    const rows: FeedbackRow[] = [
      {
        id: "m",
        source: "g2",
        sourceUrl: null,
        reviewDate: null,
        rating: 3,
        title: "Board reporting but pricing hurts",
        body: "The board reporting is great for the audit committee, but the per-vendor pricing pushed our renewal budget too high.",
        reviewerRoleRaw: "CISO",
        personaGuess: "ciso",
        scrapedAt: new Date(),
      },
    ];
    const themes = clusterThemes(rows);
    const keys = themes.map((t) => t.key);
    expect(keys).toContain("reporting-value");
    expect(keys).toContain("pricing-packaging");
  });
});
