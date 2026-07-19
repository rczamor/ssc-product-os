/**
 * Agent-facing browser CLI. A persona agent (or a human) drives the
 * SecurityScorecard platform through these commands; the browser process
 * outlives each command so login/session state persists.
 *
 *   npx tsx runner/browse.ts start --run <id>     launch persistent Chromium (leave running in background)
 *   npx tsx runner/browse.ts login                log into the platform with SSC_EMAIL/SSC_PASSWORD
 *   npx tsx runner/browse.ts goto <url>           navigate; prints SESSION_EXPIRED if bounced to login
 *   npx tsx runner/browse.ts snapshot [--max N]   print aria (accessibility) snapshot of the page
 *   npx tsx runner/browse.ts click "<selector>"   click (css / text= / role= selectors)
 *   npx tsx runner/browse.ts fill "<selector>" "<text>"
 *   npx tsx runner/browse.ts press <key>
 *   npx tsx runner/browse.ts screenshot --run <id> --persona <p> --label <slug> [--full]
 *   npx tsx runner/browse.ts eval "<js expression>"
 *   npx tsx runner/browse.ts stop                 shut the browser down
 *
 * Never prints credentials. See .claude/skills/ssc-browse/SKILL.md.
 */
import fs from "fs";
import path from "path";
import { chromium, type Page } from "playwright";
import { loadEnv } from "./lib/env";
import {
  attach,
  appendJson,
  clearBrowserInfo,
  LOGIN_URL_RE,
  PLATFORM_URL,
  readBrowserInfo,
  runDir,
  RUNS_DIR,
  sleep,
  writeBrowserInfo,
} from "./lib/session";

loadEnv();

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function positional(n: number): string | undefined {
  // argv: [node, script, command, ...positionals/flags]
  const args = process.argv.slice(3).filter((a, i, all) => {
    if (a.startsWith("--")) return false;
    const prev = all[i - 1];
    return !(prev && prev.startsWith("--") && !["--full"].includes(prev));
  });
  return args[n];
}

function die(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

async function printPageState(page: Page, note?: string): Promise<void> {
  const url = page.url();
  let title = "";
  try {
    title = await page.title();
  } catch {
    /* page may be navigating */
  }
  if (LOGIN_URL_RE.test(url)) console.log("SESSION_EXPIRED (page is a login wall)");
  console.log(`url: ${url}`);
  console.log(`title: ${title}`);
  if (note) console.log(note);
}

async function cmdStart(): Promise<void> {
  const runId = arg("--run") ?? "adhoc";
  const port = Number(process.env.BROWSE_PORT ?? 9222);
  const existing = readBrowserInfo();
  if (existing) {
    try {
      process.kill(existing.pid, 0);
      console.log(`already running (pid ${existing.pid}, port ${existing.port}) — reusing`);
      return;
    } catch {
      clearBrowserInfo();
    }
  }
  const profileDir = path.join(RUNS_DIR, ".profile");
  fs.mkdirSync(profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    userAgent: USER_AGENT,
    args: [
      `--remote-debugging-port=${port}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
    proxy: process.env.HTTPS_PROXY
      ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" }
      : undefined,
  });
  if (process.env.HTTPS_PROXY) {
    // The TLS-inspecting egress proxy resets Chromium's TLS handshakes (its
    // ClientHello is rejected upstream), while Node's TLS stack is accepted.
    // Bridge: intercept every request and replay it through Playwright's
    // Node-side fetch, so the browser never negotiates TLS itself. This
    // route lives as long as this (long-running) start process.
    await context.route("**/*", async (route) => {
      try {
        const resp = await route.fetch();
        await route.fulfill({ response: resp });
      } catch {
        await route.abort("failed").catch(() => {});
      }
    });
  }
  if (context.pages().length === 0) await context.newPage();
  writeBrowserInfo({
    port,
    pid: process.pid,
    profileDir,
    runId,
    startedAt: new Date().toISOString(),
  });
  console.log(`ready run=${runId} port=${port} pid=${process.pid}`);
  const shutdown = async () => {
    try {
      await context.close();
    } finally {
      clearBrowserInfo();
      process.exit(0);
    }
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  // Keep the process (and the browser) alive until `stop`.
  await new Promise(() => {});
}

async function firstVisible(page: Page, selectors: string[], timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    for (const sel of selectors) {
      const loc = page.locator(sel).first();
      try {
        if (await loc.isVisible()) return loc;
      } catch {
        /* invalid selector state; keep looking */
      }
    }
    if (Date.now() > deadline) return null;
    await sleep(500);
  }
}

async function cmdLogin(): Promise<void> {
  const email = process.env.SSC_EMAIL;
  const password = process.env.SSC_PASSWORD;
  if (!email || !password) die("SSC_EMAIL / SSC_PASSWORD not set (see .env.local)");

  const { browser, page } = await attach();
  try {
    await page.goto(PLATFORM_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await sleep(2_000);

    if (!LOGIN_URL_RE.test(page.url())) {
      const emailField = await firstVisible(page, ['input[type="email"]', 'input[type="password"]'], 2_000);
      if (!emailField) {
        console.log("logged-in: yes (existing session)");
        await printPageState(page);
        return;
      }
    }

    const emailInput = await firstVisible(
      page,
      [
        'input[type="email"]',
        'input[name="email"]',
        'input[name="username"]',
        'input[id*="email" i]',
        'input[placeholder*="email" i]',
      ],
      15_000,
    );
    if (!emailInput) {
      await debugShot(page, "login-no-email-field");
      die("could not find an email/username field on the login page");
    }
    await emailInput.fill(email);

    // Two-step flows show the password field only after a continue click.
    let passwordInput = await firstVisible(page, ['input[type="password"]'], 1_000);
    if (!passwordInput) {
      const cont = await firstVisible(
        page,
        [
          'button[type="submit"]',
          'button:has-text("Continue")',
          'button:has-text("Next")',
          'button:has-text("Log in")',
          'button:has-text("Sign in")',
        ],
        3_000,
      );
      if (cont) await cont.click();
      passwordInput = await firstVisible(page, ['input[type="password"]'], 10_000);
    }
    if (!passwordInput) {
      await debugShot(page, "login-no-password-field");
      die("could not find a password field (SSO-only flow?)");
    }
    await passwordInput.fill(password);

    const submit = await firstVisible(
      page,
      [
        'button[type="submit"]',
        'button:has-text("Log in")',
        'button:has-text("Sign in")',
        'button:has-text("Login")',
        'button:has-text("Continue")',
      ],
      5_000,
    );
    if (submit) await submit.click();
    else await page.keyboard.press("Enter");

    // The SPA can take a while to authenticate and render; poll rather than
    // relying on a URL change (the app keeps the same hash-routed URL).
    const deadline = Date.now() + 90_000;
    let loggedIn = false;
    while (Date.now() < deadline) {
      await sleep(3_000);
      const passwordVisible = await page
        .locator('input[type="password"]')
        .first()
        .isVisible()
        .catch(() => false);
      const title = await page.title().catch(() => "");
      if (!passwordVisible && !/log ?in|sign ?in/i.test(title)) {
        loggedIn = true;
        break;
      }
    }
    if (!loggedIn) {
      await debugShot(page, "login-failed");
      console.log("logged-in: no");
      await printPageState(page);
      process.exit(1);
    }
    console.log("logged-in: yes");
    await printPageState(page);
  } finally {
    await browser.close();
  }
}

async function debugShot(page: Page, label: string): Promise<void> {
  try {
    const dir = path.join(RUNS_DIR, "_debug");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${label}-${Date.now()}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 60 });
    console.log(`debug screenshot: ${file}`);
  } catch {
    /* best effort */
  }
}

async function cmdGoto(): Promise<void> {
  const url = positional(0);
  if (!url) die("usage: goto <url> [--wait <selector>]");
  const waitFor = arg("--wait");
  const { browser, page } = await attach();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    if (waitFor) {
      await page
        .locator(waitFor)
        .first()
        .waitFor({ state: "visible", timeout: 15_000 })
        .catch(() => console.log(`warning: --wait selector never became visible: ${waitFor}`));
    }
    await sleep(1_000);
    await printPageState(page);
  } finally {
    await browser.close();
  }
}

async function cmdSnapshot(): Promise<void> {
  const max = Number(arg("--max") ?? 40_000);
  const { browser, page } = await attach();
  try {
    const snap = await page.locator("body").ariaSnapshot();
    console.log(`url: ${page.url()}`);
    if (LOGIN_URL_RE.test(page.url())) console.log("SESSION_EXPIRED (page is a login wall)");
    console.log("--- aria snapshot ---");
    console.log(snap.length > max ? `${snap.slice(0, max)}\n… truncated (${snap.length} chars total; use --max)` : snap);
  } finally {
    await browser.close();
  }
}

async function cmdClick(): Promise<void> {
  const selector = positional(0);
  if (!selector) die('usage: click "<selector>"');
  const { browser, page } = await attach();
  try {
    await page.locator(selector).first().click({ timeout: 10_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await sleep(800);
    await printPageState(page, "clicked");
  } finally {
    await browser.close();
  }
}

async function cmdFill(): Promise<void> {
  const selector = positional(0);
  const text = positional(1);
  if (!selector || text === undefined) die('usage: fill "<selector>" "<text>"');
  const { browser, page } = await attach();
  try {
    await page.locator(selector).first().fill(text, { timeout: 10_000 });
    console.log("filled");
    console.log(`url: ${page.url()}`);
  } finally {
    await browser.close();
  }
}

async function cmdPress(): Promise<void> {
  const key = positional(0);
  if (!key) die("usage: press <key>   (e.g. Enter, Escape, ArrowDown)");
  const { browser, page } = await attach();
  try {
    await page.keyboard.press(key);
    await sleep(800);
    await printPageState(page, `pressed ${key}`);
  } finally {
    await browser.close();
  }
}

async function cmdScreenshot(): Promise<void> {
  const runId = arg("--run");
  const persona = arg("--persona") ?? "shared";
  const label = arg("--label");
  if (!runId || !label) die("usage: screenshot --run <id> --persona <p> --label <slug> [--full]");
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(label)) die("label must be a lowercase slug");
  const { browser, page } = await attach();
  try {
    const dir = runDir(runId, persona);
    const file = path.join(dir, `${label}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 60, fullPage: hasFlag("--full") });
    const viewport = page.viewportSize();
    appendJson(path.join(dir, "adhoc.json"), {
      label,
      url: page.url(),
      file: path.relative(process.cwd(), file),
      width: viewport?.width,
      height: viewport?.height,
      takenAt: new Date().toISOString(),
    });
    console.log(`screenshot: ${path.relative(process.cwd(), file)}`);
    console.log(`url: ${page.url()}`);
  } finally {
    await browser.close();
  }
}

async function cmdEval(): Promise<void> {
  const js = positional(0);
  if (!js) die('usage: eval "<js expression>"');
  const { browser, page } = await attach();
  try {
    const result = await page.evaluate(js);
    const out = JSON.stringify(result, null, 2) ?? "undefined";
    console.log(out.length > 20_000 ? out.slice(0, 20_000) + "\n… truncated" : out);
  } finally {
    await browser.close();
  }
}

async function cmdStop(): Promise<void> {
  const info = readBrowserInfo();
  if (!info) {
    console.log("no browser session recorded");
    return;
  }
  try {
    process.kill(info.pid, "SIGTERM");
    await sleep(2_000);
    try {
      process.kill(info.pid, 0);
      process.kill(info.pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  } catch {
    /* already gone */
  }
  clearBrowserInfo();
  console.log("stopped");
}

async function main(): Promise<void> {
  const command = process.argv[2];
  switch (command) {
    case "start":
      return cmdStart();
    case "login":
      return cmdLogin();
    case "goto":
      return cmdGoto();
    case "snapshot":
      return cmdSnapshot();
    case "click":
      return cmdClick();
    case "fill":
      return cmdFill();
    case "press":
      return cmdPress();
    case "screenshot":
      return cmdScreenshot();
    case "eval":
      return cmdEval();
    case "stop":
      return cmdStop();
    default:
      die(
        "unknown command — one of: start, login, goto, snapshot, click, fill, press, screenshot, eval, stop",
      );
  }
}

main().catch((e) => {
  console.error(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
