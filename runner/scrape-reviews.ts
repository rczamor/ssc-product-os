/**
 * Best-effort review-site scraper for public SecurityScorecard feedback.
 *
 *   npx tsx runner/scrape-reviews.ts [--max 60] [--out runs/feedback/scrape.json]
 *
 * Walks Capterra → G2 → TrustRadius in one throttled session (2–5s between
 * sources) via the persistent Chromium (`browse.ts start`). Each source is
 * checked for a bot wall (Cloudflare / captcha / access-denied / "unusual
 * traffic"); a blocked source is recorded and skipped — we never hammer it.
 * Reachable sources have their review cards extracted into FeedbackItems.
 *
 * Output is a ScrapedFeedback file (source + per-source `attempts` + `items`),
 * validated before writing so runner/publish-feedback.ts can ingest it.
 *
 * This is DELIBERATELY non-fatal: review sites aggressively block automated
 * traffic, so when everything is blocked the script records that honestly and
 * exits 0. The committed demo corpus (data/feedback-seed.json) is the reliable
 * ingestion source; a successful scrape simply augments it. Nothing here writes
 * to the database — publish-feedback.ts does that, idempotently.
 */
import fs from "fs";
import path from "path";
import type { Page } from "playwright";
import { loadEnv } from "./lib/env";
import { arg as argOf } from "./lib/args";
import { attach, sleep } from "./lib/session";
import {
  FeedbackItemSchema,
  FeedbackSourceSchema,
  ScrapedFeedbackSchema,
  type FeedbackItem,
} from "../lib/schemas/feedback";
import { runMain } from "./lib/zod";

loadEnv();

const ARGV = process.argv.slice(2);
const arg = (flag: string) => argOf(ARGV, flag);

interface SourceTarget {
  source: "capterra" | "g2" | "trustradius";
  url: string;
  /** Selector that, if present, indicates review content loaded. */
  ready: string;
}

const TARGETS: SourceTarget[] = [
  {
    source: "capterra",
    url: "https://www.capterra.com/p/159715/SecurityScorecard/reviews/",
    ready: "[data-testid='review-card'], .review-card, [class*='review']",
  },
  {
    source: "g2",
    url: "https://www.g2.com/products/securityscorecard/reviews",
    ready: "[itemprop='review'], article[class*='review'], div[class*='paper']",
  },
  {
    source: "trustradius",
    url: "https://www.trustradius.com/products/securityscorecard/reviews",
    ready: "[class*='ReviewCard'], article, [data-review-id]",
  },
];

const BOT_WALL_RE =
  /just a moment|checking your browser|verify you are human|unusual traffic|access denied|are you a robot|captcha|cloudflare|please enable (js|javascript)|request blocked/i;

type Outcome = "ok" | "blocked" | "empty" | "error";

/** Detect a bot wall from the page's visible text + title. */
async function detectBotWall(page: Page): Promise<boolean> {
  try {
    const title = (await page.title().catch(() => "")) ?? "";
    const bodyText = await page
      .locator("body")
      .innerText({ timeout: 5_000 })
      .catch(() => "");
    const sample = `${title}\n${bodyText.slice(0, 4_000)}`;
    return BOT_WALL_RE.test(sample);
  } catch {
    return false;
  }
}

/**
 * Extract review cards in-page. Selectors are best-effort across each site's
 * markup; anything we cannot map cleanly is dropped rather than guessed.
 * Returns raw fields; the caller stamps `source` and validates.
 */
async function extractReviews(page: Page): Promise<Array<Partial<FeedbackItem>>> {
  return page.evaluate(() => {
    const clean = (s: string | null | undefined): string =>
      (s ?? "").replace(/\s+/g, " ").trim();

    // Generic heuristic: find blocks that look like a review (a paragraph of
    // prose long enough to be a real review body), then pull nearby metadata.
    const candidates = Array.from(
      document.querySelectorAll(
        "[itemprop='review'], [data-testid*='review' i], article, [class*='review' i], [class*='ReviewCard' i]",
      ),
    ).slice(0, 120);

    const out: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    for (const el of candidates) {
      const text = clean((el as HTMLElement).innerText);
      if (text.length < 120) continue; // too short to be a review body
      const body = text.slice(0, 4_000);
      const key = body.slice(0, 120);
      if (seen.has(key)) continue;
      seen.add(key);

      const titleEl = el.querySelector(
        "h1,h2,h3,h4,[class*='title' i],[itemprop='name']",
      );
      const roleEl = el.querySelector(
        "[class*='role' i],[class*='title' i][class*='review' i],[class*='reviewer' i],[itemprop='jobTitle']",
      );
      const ratingEl = el.querySelector(
        "[itemprop='ratingValue'],[class*='rating' i],[class*='stars' i]",
      );
      const ratingRaw = ratingEl
        ? clean(ratingEl.getAttribute("content") || (ratingEl as HTMLElement).innerText)
        : "";
      const ratingMatch = ratingRaw.match(/(\d+(?:\.\d+)?)/);

      // We deliberately do NOT capture an anchor href as the review's URL: the
      // only "review"-matching link in a card is often a shared category/CTA
      // link, and using it as the dedupe key would collapse distinct reviews.
      // Leaving sourceUrl null routes dedupe through the content hash instead.
      out.push({
        title: titleEl ? clean((titleEl as HTMLElement).innerText).slice(0, 300) : null,
        body,
        reviewerRoleRaw: roleEl ? clean((roleEl as HTMLElement).innerText).slice(0, 200) : null,
        rating: ratingMatch ? Number(ratingMatch[1]) : null,
      });
    }
    return out as Array<Partial<{ title: string; body: string; reviewerRoleRaw: string; rating: number }>>;
  });
}

async function scrapeSource(
  page: Page,
  target: SourceTarget,
  max: number,
): Promise<{ outcome: Outcome; note?: string; items: FeedbackItem[] }> {
  try {
    await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await sleep(1_500);

    if (await detectBotWall(page)) {
      return { outcome: "blocked", note: "bot wall / challenge page", items: [] };
    }

    await page
      .locator(target.ready)
      .first()
      .waitFor({ state: "visible", timeout: 8_000 })
      .catch(() => {});

    const raw = await extractReviews(page);
    const items: FeedbackItem[] = [];
    for (const r of raw.slice(0, max)) {
      if (!r.body || r.body.length < 120) continue;
      // Validate each candidate individually and skip (not throw) on a bad row,
      // so one malformed card never discards an otherwise-good multi-site scrape.
      const candidate = FeedbackItemSchema.safeParse({
        source: target.source,
        sourceUrl: null,
        reviewDate: null,
        rating: typeof r.rating === "number" && r.rating >= 0 && r.rating <= 5 ? r.rating : null,
        title: r.title ?? null,
        body: r.body,
        reviewerRoleRaw: r.reviewerRoleRaw ?? null,
      });
      if (candidate.success) items.push(candidate.data);
    }
    if (items.length === 0) {
      return { outcome: "empty", note: "no review cards matched extraction selectors", items: [] };
    }
    return { outcome: "ok", items };
  } catch (e) {
    return { outcome: "error", note: e instanceof Error ? e.message : String(e), items: [] };
  }
}

async function main(): Promise<void> {
  const maxRaw = Number(arg("--max") ?? 60);
  const max = Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : 60;
  const outPath = path.resolve(
    process.cwd(),
    arg("--out") ?? "runs/feedback/scrape.json",
  );

  const attempts: Array<{ source: "capterra" | "g2" | "trustradius"; outcome: Outcome; count: number; note?: string }> = [];
  const allItems: FeedbackItem[] = [];

  let attached: Awaited<ReturnType<typeof attach>> | null = null;
  try {
    attached = await attach();
  } catch (e) {
    // No persistent browser — record honestly and let the seed carry the demo.
    const note = e instanceof Error ? e.message : String(e);
    for (const t of TARGETS) attempts.push({ source: t.source, outcome: "error", count: 0, note });
    console.log("no browser session — start one with `node bin/run.mjs npx tsx runner/browse.ts start --run adhoc`");
    console.log("recording all sources as unreachable; publish the demo seed instead.");
    writeOut(outPath, attempts, allItems);
    return;
  }

  const { browser, page } = attached;
  try {
    for (let i = 0; i < TARGETS.length; i++) {
      const t = TARGETS[i];
      const { outcome, note, items } = await scrapeSource(page, t, max);
      attempts.push({ source: t.source, outcome, count: items.length, note });
      allItems.push(...items);
      console.log(`${t.source}: ${outcome}${note ? ` (${note})` : ""} — ${items.length} items`);
      if (allItems.length >= max) break;
      // Throttle 2–5s between sources; never hammer a site.
      if (i < TARGETS.length - 1) await sleep(2_000 + (i % 3) * 1_000);
    }
  } finally {
    await browser.close();
  }

  writeOut(outPath, attempts, allItems);
}

function writeOut(
  outPath: string,
  attempts: Array<{ source: "capterra" | "g2" | "trustradius"; outcome: Outcome; count: number; note?: string }>,
  items: FeedbackItem[],
): void {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const firstOk = attempts.find((a) => a.outcome === "ok");
  const payload = {
    // ScrapedFeedback requires a top-level source; use the first reachable one,
    // else default to capterra (the attempts array carries the real per-source detail).
    source: FeedbackSourceSchema.parse(firstOk?.source ?? "capterra"),
    scrapedAt: new Date().toISOString(),
    attempts,
    items,
  };

  if (items.length === 0) {
    // Nothing scraped — write attempts only (ScrapedFeedbackSchema needs ≥1
    // item, so persist a lighter record the panel/publisher can still read).
    fs.writeFileSync(outPath, JSON.stringify({ ...payload, items: [] }, null, 2));
    console.log(
      `\nscraped 0 items (all sources blocked or empty) → ${path.relative(process.cwd(), outPath)}`,
    );
    console.log("publish the demo corpus: node bin/run.mjs npx tsx runner/publish-feedback.ts");
    return;
  }

  // Validate the happy-path shape before writing so publish can trust it.
  ScrapedFeedbackSchema.parse(payload);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(
    `\nscraped ${items.length} items → ${path.relative(process.cwd(), outPath)}`,
  );
  console.log(
    `publish: node bin/run.mjs npx tsx runner/publish-feedback.ts --file ${path.relative(process.cwd(), outPath)}`,
  );
}

runMain(main);
