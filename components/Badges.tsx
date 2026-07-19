import {
  PERSONA_LABELS,
  ROOT_CAUSE_LABELS,
  VERDICT_LABELS,
  type PersonaSlug,
  type RootCause,
} from "@/lib/schemas/findings";

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  running: "bg-blue-50 text-blue-700 ring-blue-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
  queued: "bg-amber-50 text-amber-700 ring-amber-200",
  claimed: "bg-blue-50 text-blue-700 ring-blue-200",
  cancelled: "bg-slate-100 text-slate-500 ring-slate-200",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${style}`}>
      {status}
    </span>
  );
}

export function PersonaBadge({ persona }: { persona: string }) {
  return (
    <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
      {PERSONA_LABELS[persona as PersonaSlug] ?? persona}
    </span>
  );
}

const VERDICT_STYLES: Record<string, string> = {
  kill: "bg-red-50 text-red-700 ring-red-200",
  fix: "bg-amber-50 text-amber-700 ring-amber-200",
  double_down: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function VerdictBadge({ verdict }: { verdict: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${VERDICT_STYLES[verdict] ?? ""}`}
    >
      {VERDICT_LABELS[verdict as keyof typeof VERDICT_LABELS] ?? verdict}
    </span>
  );
}

export function RootCauseBadge({ rootCause }: { rootCause: string | null }) {
  if (!rootCause) return null;
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
      {ROOT_CAUSE_LABELS[rootCause as RootCause] ?? rootCause}
    </span>
  );
}
