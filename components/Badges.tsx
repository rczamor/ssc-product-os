import {
  PERSONA_LABELS,
  ROOT_CAUSE_LABELS,
  VERDICT_LABELS,
  type PersonaSlug,
  type RootCause,
} from "@/lib/schemas/findings";

const STATUS_STYLES: Record<string, string> = {
  completed: "verdict-double_down",
  running: "border-accent/30 bg-accent/10 text-accent",
  failed: "verdict-kill",
  queued: "verdict-fix",
  claimed: "border-accent/30 bg-accent/10 text-accent",
  cancelled: "border-line text-ink-4",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "border-line text-ink-4";
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${style}`}
    >
      {status}
    </span>
  );
}

export function PersonaBadge({ persona }: { persona: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium persona-${persona}`}
    >
      {PERSONA_LABELS[persona as PersonaSlug] ?? persona}
    </span>
  );
}

export function VerdictBadge({ verdict }: { verdict: string }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide verdict-${verdict}`}
    >
      {VERDICT_LABELS[verdict as keyof typeof VERDICT_LABELS] ?? verdict}
    </span>
  );
}

export function RootCauseBadge({ rootCause }: { rootCause: string | null }) {
  if (!rootCause) return null;
  return (
    <span className="inline-flex rounded-md border border-line bg-card-alt px-2 py-0.5 text-[11px] font-medium text-ink-3">
      {ROOT_CAUSE_LABELS[rootCause as RootCause] ?? rootCause}
    </span>
  );
}
