import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb, isPersistentDb } from "@/lib/db";
import { runRequests } from "@/lib/db/schema";
import { getIngestionSummary, listRunsWithCounts } from "@/lib/db/queries";
import { clusterThemes } from "@/lib/feedback-themes";
import { loadPersonas } from "@/lib/personas";
import { formatTimestamp } from "@/lib/validation";
import { StatusBadge, PersonaBadge } from "@/components/Badges";
import TriggerRunButton from "@/components/TriggerRunButton";
import CancelRequestButton from "@/components/CancelRequestButton";
import IngestionPanel, { type PersonaKnowledgeBase } from "@/components/IngestionPanel";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const db = await getDb();
  const enriched = await listRunsWithCounts(25);
  const requests = await db
    .select()
    .from(runRequests)
    .orderBy(desc(runRequests.createdAt))
    .limit(10);

  const ingestion = await getIngestionSummary();
  const themes = clusterThemes(ingestion.items);
  const personaDocs = loadPersonas();
  const personaBases: PersonaKnowledgeBase[] = personaDocs.map((p) => ({
    slug: p.slug,
    name: p.name,
    title: p.title,
    created: p.created,
    jtbdCount: p.jtbd.length,
    corpusCount: p.corpus.length,
    feedbackCount: ingestion.personaCounts[p.slug] ?? 0,
  }));

  return (
    <div className="space-y-6">
      {!isPersistentDb() && (
        <div className="rounded-lg border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber-dark">
          Running on ephemeral demo storage — set <code>DATABASE_URL</code> (Neon) in the
          environment to persist runs.
        </div>
      )}

      <TriggerRunButton />

      <IngestionPanel summary={ingestion} themes={themes} personas={personaBases} />

      <section className="rounded-[11px] border border-line bg-card shadow-card">
        <div className="border-b border-line-2 px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Run queue</h2>
        </div>
        {requests.length === 0 ? (
          <p className="px-5 py-4 text-sm text-ink-4">No run requests yet.</p>
        ) : (
          <ul className="divide-y divide-line-2">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <StatusBadge status={r.status} />
                <span className="flex gap-1">
                  {(r.personas as string[]).map((p) => (
                    <PersonaBadge key={p} persona={p} />
                  ))}
                </span>
                <span className="text-ink-4">{r.note}</span>
                <span className="ml-auto font-mono text-xs text-ink-5">
                  {formatTimestamp(r.createdAt)} · {r.requestedBy}
                </span>
                {r.runId && (
                  <Link href={`/runs/${r.runId}`} className="text-xs text-accent hover:underline">
                    run →
                  </Link>
                )}
                {(r.status === "queued" || r.status === "claimed") && (
                  <CancelRequestButton id={r.id} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[11px] border border-line bg-card shadow-card">
        <div className="border-b border-line-2 px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Evaluation runs</h2>
        </div>
        {enriched.length === 0 ? (
          <p className="px-5 py-4 text-sm text-ink-4">
            No runs yet — queue one above or run <code>/platform-review</code> in a Claude Code
            session.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-5">
              <tr className="border-b border-line-2">
                <th className="px-5 py-2 font-semibold">Started</th>
                <th className="px-2 py-2 font-semibold">Status</th>
                <th className="px-2 py-2 font-semibold">Trigger</th>
                <th className="px-2 py-2 font-semibold">Personas</th>
                <th className="px-2 py-2 font-semibold">Likes</th>
                <th className="px-2 py-2 font-semibold">Dislikes</th>
                <th className="px-2 py-2 font-semibold">Deliverable</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              {enriched.map((run) => (
                <tr key={run.id} className="hover:bg-card-alt">
                  <td className="px-5 py-3 font-mono text-ink-3">{formatTimestamp(run.startedAt)}</td>
                  <td className="px-2 py-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-2 py-3 text-ink-4">{run.trigger}</td>
                  <td className="px-2 py-3">
                    <span className="flex gap-1">
                      {(run.personas as string[]).map((p) => (
                        <PersonaBadge key={p} persona={p} />
                      ))}
                    </span>
                  </td>
                  <td className="px-2 py-3 font-mono text-green-dark">{run.likeCount}</td>
                  <td className="px-2 py-3 font-mono text-red">{run.dislikeCount}</td>
                  <td className="px-2 py-3">{run.hasDeliverable ? "✓" : "—"}</td>
                  <td className="px-2 py-3">
                    <Link
                      href={`/runs/${run.id}`}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      view →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
