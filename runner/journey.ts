/**
 * Scripted journey executor: guaranteed coverage + artifacts for a persona.
 *   npx tsx runner/journey.ts --run <id> --persona <ciso|vrm|gtm_cs>
 *
 * For each stop in runner/journeys/<persona>.json: navigate, screenshot
 * (JPEG q60), and dump an aria snapshot. Artifacts land in
 * runs/<id>/<persona>/ for the persona agent to read; the agent then deviates
 * interactively with browse.ts wherever something looks interesting.
 */
import fs from "fs";
import path from "path";
import { loadEnv } from "./lib/env";
import { attach, LOGIN_URL_RE, runDir, sleep } from "./lib/session";
import { recordStopSpan, startPersonaSpan, flushLangfuse } from "./trace";

loadEnv();

interface JourneyStop {
  label: string;
  url: string;
  waitFor?: string;
  note?: string;
}

interface Journey {
  persona: string;
  description: string;
  stops: JourneyStop[];
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const runId = arg("--run");
  const persona = arg("--persona");
  if (!runId || !persona) throw new Error("usage: journey.ts --run <id> --persona <p>");

  const journeyPath = path.join(process.cwd(), "runner", "journeys", `${persona}.json`);
  if (!fs.existsSync(journeyPath)) throw new Error(`no journey file: ${journeyPath}`);
  const journey = JSON.parse(fs.readFileSync(journeyPath, "utf8")) as Journey;

  const dir = runDir(runId, persona);
  const { browser, page } = await attach();
  startPersonaSpan(runId, persona);
  const results: Array<Record<string, unknown>> = [];

  try {
    for (const stop of journey.stops) {
      const started = Date.now();
      let status = "ok";
      try {
        await page.goto(stop.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        if (stop.waitFor) {
          await page
            .locator(stop.waitFor)
            .first()
            .waitFor({ state: "visible", timeout: 15_000 })
            .catch(() => {});
        }
        await sleep(6_000);

        if (LOGIN_URL_RE.test(page.url()) || /log ?in/i.test(await page.title())) {
          status = "session-expired";
        } else {
          const shotFile = path.join(dir, `${stop.label}.jpg`);
          await page.screenshot({ path: shotFile, type: "jpeg", quality: 60 });
          const snap = await page.locator("body").ariaSnapshot();
          fs.writeFileSync(path.join(dir, `${stop.label}.snapshot.txt`), `url: ${page.url()}\nnote: ${stop.note ?? ""}\n\n${snap}`);
        }
      } catch (e) {
        status = `error: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`;
      }
      const entry = {
        label: stop.label,
        url: stop.url,
        finalUrl: page.url(),
        note: stop.note,
        status,
        ms: Date.now() - started,
        file: `runs/${runId}/${persona}/${stop.label}.jpg`,
      };
      results.push(entry);
      recordStopSpan(runId, persona, {
        label: stop.label,
        url: stop.url,
        note: `${status} in ${entry.ms}ms`,
      });
      console.log(`${stop.label}: ${status}`);
    }
  } finally {
    fs.writeFileSync(path.join(dir, "journey.json"), JSON.stringify(results, null, 2));
    await flushLangfuse();
    await browser.close();
  }

  const expired = results.filter((r) => r.status === "session-expired").length;
  if (expired > 0) {
    console.log(`WARNING: ${expired} stop(s) hit a login wall — run \`browse.ts login\` and re-run this journey`);
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
