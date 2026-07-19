import { ZodError } from "zod";

/**
 * Uniform, agent-actionable formatting of a ZodError — the fix-and-retry loop
 * the persona/synthesizer/judge agents run around depends on this exact
 * "SCHEMA INVALID" shape, so every runner script that validates agent output
 * must use it (not just publish.ts).
 */
export function printError(e: unknown): void {
  if (e instanceof ZodError) {
    console.error("SCHEMA INVALID — fix these issues in the JSON and retry:");
    for (const issue of e.issues) {
      console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
  } else {
    console.error(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Standard runner entry wrapper: run main(), format errors, exit non-zero. */
export function runMain(main: () => Promise<void>): void {
  main().catch((e) => {
    printError(e);
    process.exit(1);
  });
}
