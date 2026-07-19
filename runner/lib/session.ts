import fs from "fs";
import path from "path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export const RUNS_DIR = path.join(process.cwd(), "runs");
const BROWSER_INFO_PATH = path.join(RUNS_DIR, "browser.json");

export const PLATFORM_URL = "https://platform.securityscorecard.io/";

/** URLs that mean we're looking at a login wall rather than the app. */
export const LOGIN_URL_RE = /login|sign[-_]?in|signin|auth0|okta|sso|session/i;

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
  const pages = context.pages();
  const page = pages.length > 0 ? pages[pages.length - 1] : await context.newPage();
  return { browser, context, page };
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
