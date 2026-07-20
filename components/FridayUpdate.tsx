"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatTimestamp } from "@/lib/validation";
import type { FridayUpdate as FridayUpdateData } from "@/lib/schemas/friday";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <div className="mt-1 text-sm text-slate-700">{children}</div>
    </div>
  );
}

function IssueList({
  items,
  empty,
  dateLabel,
}: {
  items: Array<{ identifier: string; title: string; url: string | null; date: string; extra?: string }>;
  empty: string;
  dateLabel: string;
}) {
  if (items.length === 0) return <p className="text-slate-400">{empty}</p>;
  return (
    <ul className="space-y-1">
      {items.map((i) => (
        <li key={i.identifier} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {i.url ? (
            <a href={i.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
              {i.identifier}
            </a>
          ) : (
            <span className="text-slate-400">{i.identifier}</span>
          )}
          <span>{i.title}</span>
          <span className="text-xs text-slate-400">
            {dateLabel} {i.date}
            {i.extra ? ` · ${i.extra}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function FridayUpdate({ update: initial }: { update: FridayUpdateData | null }) {
  const router = useRouter();
  const [update, setUpdate] = useState(initial);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/friday", { method: "POST" });
      if (res.ok) {
        const j = await res.json();
        setUpdate(j.update);
        router.refresh();
      } else {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? `Generation failed (${res.status}).`);
      }
    } catch {
      setError("Network error while generating.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Friday Product &amp; Engineering Update</h2>
          <p className="text-xs text-slate-400">
            {update
              ? `Generated ${formatTimestamp(update.generatedAt)} · window ${update.windowStart} → ${update.windowEnd}`
              : "Not generated yet."}
          </p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {generating ? "Generating…" : update ? "Regenerate update" : "Generate update"}
        </button>
      </div>
      {error && <p className="mb-3 text-xs text-red-600">{error}</p>}

      {!update ? (
        <p className="text-sm text-slate-400">
          Click <b>Generate update</b> to build a Friday Update from the live board, this week&apos;s metric
          deltas, and the current run&apos;s findings.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Section title="Shipped">
            <IssueList
              items={update.shipped.map((s) => ({ ...s, date: s.completedAt.slice(0, 10) }))}
              empty="Nothing moved to Done this window."
              dateLabel="done"
            />
          </Section>
          <Section title="Slipped">
            <IssueList
              items={update.slipped.map((s) => ({ ...s, date: s.dueDate, extra: `${s.daysLate}d late` }))}
              empty="Nothing is past due."
              dateLabel="due"
            />
          </Section>
          <Section title="Customer impact">{update.customerImpact}</Section>
          <Section title="Adoption">{update.adoption}</Section>
          <Section title="Velocity">{update.velocity}</Section>
          <Section title="AI usage">
            {update.aiUsage.narrative}
            <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
              <span className="rounded bg-slate-100 px-1.5 py-0.5">
                containment {update.aiUsage.containmentRatePercent != null ? `${update.aiUsage.containmentRatePercent.toFixed(0)}%` : "—"}
              </span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5">{update.aiUsage.workflowsRunCount} workflows run</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5">
                agree-rate {update.aiUsage.agreeRatePercent != null ? `${update.aiUsage.agreeRatePercent.toFixed(0)}%` : "—"}
              </span>
            </div>
          </Section>
          <Section title="Risks">
            <ul className="list-inside list-disc space-y-0.5">
              {update.risks.map((r, idx) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
          </Section>
          <div className="sm:col-span-2">
            <Section title="One win to celebrate">🎉 {update.oneWin}</Section>
          </div>
        </div>
      )}
    </section>
  );
}
