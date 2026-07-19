import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { loadPersonas, loadSharedCorpus, type CorpusDoc } from "@/lib/personas";
import { PersonaBadge } from "@/components/Badges";

export const dynamic = "force-dynamic";

function CorpusList({ docs }: { docs: CorpusDoc[] }) {
  return (
    <div className="mt-3 space-y-2">
      {docs.map((doc) => (
        <details
          key={doc.slug}
          className="group rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3"
        >
          <summary className="cursor-pointer text-sm font-medium text-slate-700 marker:text-slate-400">
            {doc.title}
            <span className="ml-2 text-xs font-normal text-slate-400">
              {doc.tags.join(" · ")} · retrieved {doc.retrievedAt}
            </span>
          </summary>
          <div className="prose prose-sm mt-3 max-w-none prose-headings:text-slate-800 prose-a:text-indigo-600">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.body}</ReactMarkdown>
          </div>
          {doc.sources.length > 0 && (
            <div className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-500">
              Sources:{" "}
              {doc.sources.map((s, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  <a
                    className="text-indigo-600 hover:underline"
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {s.title}
                  </a>
                </span>
              ))}
            </div>
          )}
        </details>
      ))}
    </div>
  );
}

export default async function PersonasPage() {
  const personas = loadPersonas();
  const shared = loadSharedCorpus();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Personas & knowledge corpus</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          The documented user personas the evaluation agents embody, and the locally-hosted
          research corpus that grounds them. Agents read these files
          (<code>personas/…</code> in the repo) before touching the product.
        </p>
      </div>

      {personas.map((p) => (
        <section
          key={p.slug}
          id={p.slug}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold">{p.name}</h2>
            <PersonaBadge persona={p.slug} />
            <span className="text-sm text-slate-500">{p.title}</span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">{p.companyProfile}</p>

          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Jobs to be done
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {p.jtbd.map((j, i) => (
                  <li key={i}>{j}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                KPIs
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {p.kpis.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </div>
          </div>

          <details className="mt-5 rounded-lg border border-slate-200 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Full persona document
            </summary>
            <div className="prose prose-sm mt-3 max-w-none prose-headings:text-slate-800">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.body}</ReactMarkdown>
            </div>
          </details>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Knowledge corpus ({p.corpus.length} docs)
          </h3>
          <CorpusList docs={p.corpus} />
        </section>
      ))}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">Shared corpus</h2>
        <p className="mt-1 text-sm text-slate-500">
          Product, market, and criticism context all personas ground in.
        </p>
        <CorpusList docs={shared} />
      </section>
    </div>
  );
}
