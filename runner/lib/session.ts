import fs from "fs";
import path from "path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export const RUNS_DIR = path.join(process.cwd(), "runs");
const BROWSER_INFO_PATH = path.join(RUNS_DIR, "browser.json");

export const PLATFORM_URL = "https://platform.securityscorecard.io/";
const PLATFORM_HOST = "platform.securityscorecard.io";

/**
 * Auth hosts/paths that mean a login wall. Matched only against the part of
 * the URL BEFORE the hash — vendor scorecards live in the hash route
 * (`#/scorecard/okta.com`), and matching the whole URL would misread those
 * (and any domain containing sso/session/login) as an expired session.
 */
const LOGIN_URL_RE = /login|sign[-_]?in|signin|auth0|okta\.com|\/sso|session/i;
const LOGIN_TITLE_RE = /\blog ?in\b|\bsign ?in\b/i;

/** Server path of a URL, without the SPA hash route or query string. */
export function preHash(url: string): string {
  return url.split("#")[0].split("?")[0];
}

/** True when only the URL is available (no page) — checks the pre-hash path. */
export function urlLooksLikeLogin(url: string): boolean {
  return LOGIN_URL_RE.test(preHash(url));
}

/**
 * Authoritative "are we bounced to a login wall" check. Combines the URL
 * (pre-hash only), the page title, and — decisively — a visible password
 * field, so an authenticated vendor page is never misread as logged-out.
 */
export async function isLoginWall(page: Page): Promise<boolean> {
  if (urlLooksLikeLogin(page.url())) return true;
  const title = await page.title().catch(() => "");
  if (LOGIN_TITLE_RE.test(title)) return true;
  return page
    .locator('input[type="password"]')
    .first()
    .isVisible()
    .catch(() => false);
}

export interface BrowserInfo {
  port: number;
  pid: number;
  profileDir: string;
  runId: string;
  startedAt: string;
}

export function writeBrowserInfo(info: BrowserInfo): void {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  fs.writeFileSync(BROWSER_INFO_PATH, JSON.stringify(info, null, 2));
}

export function readBrowserInfo(): BrowserInfo | null {
  if (!fs.existsSync(BROWSER_INFO_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(BROWSER_INFO_PATH, "utf8")) as BrowserInfo;
  } catch {
    return null;
  }
}

export function clearBrowserInfo(): void {
  if (fs.existsSync(BROWSER_INFO_PATH)) fs.unlinkSync(BROWSER_INFO_PATH);
}

export interface Attached {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

/**
 * Attaches to the long-lived Chromium started by `browse.ts start` via CDP.
 * Every short-lived runner command uses this; the browser (cookies, SPA
 * state) lives on across processes.
 */
export async function attach(): Promise<Attached> {
  const info = readBrowserInfo();
  if (!info) {
    throw new Error("no browser session — run `browse.ts start --run <id>` first");
  }
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${info.port}`, {
    timeout: 10_000,
  });
  const context = browser.contexts()[0];
  if (!context) throw new Error("browser has no context — restart the session");
  const page = await pickPlatformPage(context);
  return { browser, context, page };
}

/**
 * Choose the working page. Prefer the most-recent tab still on the platform
 * origin, so a stray popup (a target=_blank docs/report tab on another origin)
 * doesn't hijack every subsequent command. Falls back to the last page, then
 * a fresh one.
 */
async function pickPlatformPage(context: BrowserContext): Promise<Page> {
  const pages = context.pages();
  if (pages.length === 0) return context.newPage();
  const onPlatform = pages.filter((p) => {
    try {
      return new URL(p.url()).host === PLATFORM_HOST;
    } catch {
      return false;
    }
  });
  const pool = onPlatform.length > 0 ? onPlatform : pages;
  return pool[pool.length - 1];
}

/**
 * Guarded JSON read: parse errors carry the offending file path so an agent's
 * retry loop knows which artifact is corrupt.
 */
export function readJsonFile<T = unknown>(file: string): T {
  if (!fs.existsSync(file)) throw new Error(`missing file: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch (e) {
    throw new Error(`invalid JSON in ${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Resolve an agent-supplied screenshot path (stored cwd-relative, e.g.
 * "runs/<id>/<persona>/x.jpg") and require it to stay inside runs/, so a
 * crafted `file` field like "../../.env.local" can never be read and served.
 */
export function resolveInRuns(cwdRelative: string): string {
  const resolved = path.resolve(process.cwd(), cwdRelative);
  const root = path.resolve(RUNS_DIR);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`path escapes runs/: ${cwdRelative}`);
  }
  return resolved;
}

/** Validate an id/slug that gets interpolated into a filesystem path. */
export function assertSafeSegment(kind: string, value: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value)) {
    throw new Error(`unsafe ${kind}: ${value}`);
  }
  return value;
}

export function runDir(runId: string, persona?: string): string {
  const dir = persona ? path.join(RUNS_DIR, runId, persona) : path.join(RUNS_DIR, runId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Append an entry to a JSON-array file (creates it if missing). */
export function appendJson(file: string, entry: unknown): void {
  let arr: unknown[] = [];
  if (fs.existsSync(file)) {
    try {
      arr = JSON.parse(fs.readFileSync(file, "utf8")) as unknown[];
    } catch {
      arr = [];
    }
  }
  arr.push(entry);
  fs.writeFileSync(file, JSON.stringify(arr, null, 2));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
