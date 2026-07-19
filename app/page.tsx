import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, isPersistentDb } from "@/lib/db";
import { deliverables, findings, runRequests, runs } from "@/lib/db/schema";
import { StatusBadge, PersonaBadge } from "@/components/Badges";
import TriggerRunButton from "@/components/TriggerRunButton";
import CancelRequestButton from "@/components/CancelRequestButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const db = await getDb();
  const runRows = await db.select().from(runs).orderBy(desc(runs.startedAt)).limit(25);
  const requests = await db
    .select()
    .from(runRequests)
    .orderBy(desc(runRequests.createdAt))
    .limit(10);

  const enriched = await Promise.all(
    runRows.map(async (run) => {
      const [counts] = await db
        .select({
          likes: sql<number>`count(*) filter (where ${findings.kind} = 'like')`,
          dislikes: sql<number>`count(*) filter (where ${findings.kind} = 'dislike')`,
        })
        .from(findings)
        .where(eq(findings.runId, run.id));
      const [d] = await db
        .select({ id: deliverables.id })
        .from(deliverables)
        .where(eq(deliverables.runId, run.id));
      return {
        ...run,
        likes: Number(counts?.likes ?? 0),
        dislikes: Number(counts?.dislikes ?? 0),
        hasDeliverable: Boolean(d),
      };
    }),
  );

  return (
    <div className="space-y-6">
      {!isPersistentDb() && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Running on ephemeral demo storage — set <code>DATABASE_URL</code> (Neon) in the
          environment to persist runs.
        </div>
      )}

      <TriggerRunButton />

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold">Run queue</h2>
        </div>
        {requests.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-500">No run requests yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <StatusBadge status={r.status} />
                <span className="flex gap-1">
                  {(r.personas as string[]).map((p) => (
                    <PersonaBadge key={p} persona={p} />
                  ))}
                </span>
                <span className="text-slate-500">{r.note}</span>
                <span className="ml-auto text-xs text-slate-400">
                  {r.createdAt?.toISOString().slice(0, 16).replace("T", " ")} · {r.requestedBy}
                </span>
                {r.runId && (
                  <Link href={`/runs/${r.runId}`} className="text-xs text-indigo-600 hover:underline">
                    run →
                  </Link>
                )}
                {r.status === "queued" && <CancelRequestButton id={r.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold">Evaluation runs</h2>
        </div>
        {enriched.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-500">
            No runs yet — queue one above or run <code>/platform-review</code> in a Claude Code
            session.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100">
                <th className="px-5 py-2 font-medium">Started</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Trigger</th>
                <th className="px-2 py-2 font-medium">Personas</th>
                <th className="px-2 py-2 font-medium">Likes</th>
                <th className="px-2 py-2 font-medium">Dislikes</th>
                <th className="px-2 py-2 font-medium">Deliverable</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enriched.map((run) => (
                <tr key={run.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-600">
                    {run.startedAt?.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-2 py-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-2 py-3 text-slate-500">{run.trigger}</td>
                  <td className="px-2 py-3">
                    <span className="flex gap-1">
                      {(run.personas as string[]).map((p) => (
                        <PersonaBadge key={p} persona={p} />
                      ))}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-emerald-700">{run.likes}</td>
                  <td className="px-2 py-3 text-red-700">{run.dislikes}</td>
                  <td className="px-2 py-3">{run.hasDeliverable ? "✓" : "—"}</td>
                  <td className="px-2 py-3">
                    <Link
                      href={`/runs/${run.id}`}
                      className="text-xs font-medium text-indigo-600 hover:underline"
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
