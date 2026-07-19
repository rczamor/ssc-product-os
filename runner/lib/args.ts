/**
 * Shared argv parsing for the runner CLIs. Previously each script hand-rolled
 * its own arg()/hasFlag()/positional(); centralizing fixes two bugs uniformly:
 *   - arg() returned the next token even when it was another flag (so
 *     `--error --status x` stored '--status' as the error);
 *   - positional() dropped anything starting with '--' via a hidden allowlist,
 *     so a value like '--weird' was untypeable and any new boolean flag broke
 *     the next positional.
 *
 * Convention: positionals come before flags; a literal `--` ends option
 * parsing so genuinely dash-prefixed values can follow it.
 */

/** Value of `--flag`, or undefined. Returns undefined if the next token is
 *  itself a flag (a missing value), never the following flag. */
export function arg(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i < 0) return undefined;
  const next = argv[i + 1];
  if (next === undefined || (next.startsWith("--") && next !== "--")) return undefined;
  return next;
}

export function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

/**
 * Positional args, in order. Everything before the first `--flag` is a
 * positional; everything after a literal `--` separator is also a positional
 * (the escape hatch for dash-prefixed values).
 */
export function positionals(argv: string[]): string[] {
  const out: string[] = [];
  let optionsEnded = false;
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (optionsEnded) {
      out.push(tok);
      continue;
    }
    if (tok === "--") {
      optionsEnded = true;
      continue;
    }
    if (tok.startsWith("--")) break;
    out.push(tok);
  }
  return out;
}
