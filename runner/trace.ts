import { Langfuse } from "langfuse";

/**
 * Langfuse wiring for runner scripts. All observability flows through here;
 * agents never touch Langfuse keys. When keys are absent every helper
 * no-ops with a single warning, so runs work before Langfuse is configured.
 *
 * Trace structure (trace id == run id, so the admin UI can deep-link):
 *   trace platform-review
 *   ├─ span persona:<p>            id `${runId}-<p>`
 *   │   ├─ span stop:<label>       one per journey stop
 *   │   └─ generation persona-eval output = validated PersonaOutput
 *   ├─ generation synthesis        output = validated Deliverable
 *   └─ scores specificity / actionability per finding + deliverable_quality
 */

let client: Langfuse | null | undefined;
let warned = false;

export function getLangfuse(): Langfuse | null {
  if (client !== undefined) return client;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  if (!publicKey || !secretKey) {
    if (!warned) {
      console.warn("langfuse: LANGFUSE_PUBLIC_KEY/SECRET_KEY not set — tracing disabled");
      warned = true;
    }
    client = null;
    return null;
  }
  client = new Langfuse({
    publicKey,
    secretKey,
    baseUrl: process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com",
  });
  return client;
}

export function personaSpanId(runId: string, persona: string): string {
  return `${runId}-${persona}`;
}

export function ensureRunTrace(
  runId: string,
  metadata: Record<string, unknown>,
): void {
  getLangfuse()?.trace({
    id: runId,
    name: "platform-review",
    metadata,
    tags: ["ssc-product-os"],
  });
}

export function startPersonaSpan(runId: string, persona: string): void {
  getLangfuse()?.span({
    id: personaSpanId(runId, persona),
    traceId: runId,
    name: `persona:${persona}`,
  });
}

export function recordStopSpan(
  runId: string,
  persona: string,
  stop: { label: string; url: string; screenshotFile?: string; note?: string },
): void {
  getLangfuse()?.span({
    id: `${personaSpanId(runId, persona)}-${stop.label}`,
    traceId: runId,
    parentObservationId: personaSpanId(runId, persona),
    name: `stop:${stop.label}`,
    metadata: stop,
    endTime: new Date(),
  });
}

export function recordGeneration(opts: {
  runId: string;
  name: string;
  persona?: string;
  input: unknown;
  output: unknown;
  metadata?: Record<string, unknown>;
}): void {
  getLangfuse()?.generation({
    id: `${opts.runId}-${opts.name}`,
    traceId: opts.runId,
    parentObservationId: opts.persona ? personaSpanId(opts.runId, opts.persona) : undefined,
    name: opts.name,
    model: "claude-code-subagent",
    input: opts.input,
    output: opts.output,
    metadata: opts.metadata,
    endTime: new Date(),
  });
}

export function recordScore(opts: {
  runId: string;
  name: string;
  value: number;
  observationId?: string;
  comment?: string;
}): void {
  getLangfuse()?.score({
    traceId: opts.runId,
    observationId: opts.observationId,
    name: opts.name,
    value: opts.value,
    comment: opts.comment,
  });
}

export async function flushLangfuse(): Promise<void> {
  const lf = getLangfuse();
  if (lf) await lf.flushAsync();
}
