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
          className="group rounded-lg border border-line bg-card-alt px-4 py-3"
        >
          <summary className="cursor-pointer text-sm font-medium text-ink-2 marker:text-ink-5">
            {doc.title}
            <span className="ml-2 text-xs font-normal text-ink-5">
              {doc.tags.join(" · ")} · retrieved {doc.retrievedAt}
            </span>
          </summary>
          <div className="prose prose-sm mt-3 max-w-none prose-headings:text-ink-2 prose-a:text-accent">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.body}</ReactMarkdown>
          </div>
          {doc.sources.length > 0 && (
            <div className="mt-3 border-t border-line pt-2 text-xs text-ink-4">
              Sources:{" "}
              {doc.sources.map((s, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  <a
                    className="text-accent hover:underline"
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
        <h1 className="text-lg font-semibold text-ink">Personas & knowledge corpus</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-4">
          The documented user personas the evaluation agents embody, and the locally-hosted
          research corpus that grounds them. Agents read these files
          (<code>personas/…</code> in the repo) before touching the product.
        </p>
      </div>

      {personas.map((p) => (
        <section
          key={p.slug}
          id={p.slug}
          className="rounded-[11px] border border-line bg-card p-6 shadow-card"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold text-ink">{p.name}</h2>
            <PersonaBadge persona={p.slug} />
            <span className="text-sm text-ink-4">{p.title}</span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-ink-3">{p.companyProfile}</p>

          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-5">
                Jobs to be done
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-3">
                {p.jtbd.map((j, i) => (
                  <li key={i}>{j}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-5">
                KPIs
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-3">
                {p.kpis.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </div>
          </div>

          <details className="mt-5 rounded-lg border border-line px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-ink-2">
              Full persona document
            </summary>
            <div className="prose prose-sm mt-3 max-w-none prose-headings:text-ink-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.body}</ReactMarkdown>
            </div>
          </details>

          <h3 className="mt-5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-5">
            Knowledge corpus ({p.corpus.length} docs)
          </h3>
          <CorpusList docs={p.corpus} />
        </section>
      ))}

      <section className="rounded-[11px] border border-line bg-card p-6 shadow-card">
        <h2 className="text-base font-semibold text-ink">Shared corpus</h2>
        <p className="mt-1 text-sm text-ink-4">
          Product, market, and criticism context all personas ground in.
        </p>
        <CorpusList docs={shared} />
      </section>
    </div>
  );
}
