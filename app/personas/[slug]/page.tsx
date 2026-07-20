import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPersonaFindings } from "@/lib/db/queries";
import { loadPersonas, type Force } from "@/lib/personas";
import { PERSONA_COLORS } from "@/lib/persona-colors";
import { PERSONAS, type PersonaSlug } from "@/lib/schemas/findings";

export const dynamic = "force-dynamic";

const VERDICT_COLOR: Record<string, string> = {
  kill: "#cc3b46",
  fix: "#b07714",
  double_down: "#1f9d63",
};

function ForceColumn({
  label,
  headerBg,
  headerColor,
  items,
}: {
  label: string;
  headerBg: string;
  headerColor: string;
  items: Force[];
}) {
  return (
    <div className="overflow-hidden rounded-[11px] border border-line bg-card">
      <div
        className="border-b border-line-2 px-[15px] py-[10px] text-[11.5px] font-bold"
        style={{ background: headerBg, color: headerColor }}
      >
        {label}
      </div>
      {items.map((f, i) => (
        <div key={i} className="border-b border-card-subtle px-[15px] py-[13px] last:border-b-0">
          <div className="mb-[5px] flex items-center gap-[7px]">
            <span className="text-[14px]">{f.icon}</span>
            <span className="text-[12px] font-bold text-ink">{f.key}</span>
          </div>
          <div className="text-[12px] leading-[1.5] text-ink-4">{f.text}</div>
        </div>
      ))}
    </div>
  );
}

export default async function PersonaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(PERSONAS as readonly string[]).includes(slug)) notFound();
  const personaSlug = slug as PersonaSlug;

  const persona = loadPersonas().find((p) => p.slug === personaSlug);
  if (!persona) notFound();

  const colors = PERSONA_COLORS[personaSlug];
  const { findings } = await getPersonaFindings(personaSlug);

  return (
    <div className="mx-auto max-w-[1040px] animate-fadeup px-6 pb-[70px] pt-[22px]">
      <Link
        href="/"
        className="mb-4 inline-block text-[12.5px] font-semibold text-ink-4 hover:text-ink"
      >
        ← Back to Planning
      </Link>

      {/* Header */}
      <div className="mb-5 flex items-start gap-[14px]">
        <span
          className="mt-[6px] h-[14px] w-[14px] flex-none rounded"
          style={{ background: colors.color }}
        />
        <div className="flex-1">
          <h1 className="text-[24px] font-bold tracking-[-0.02em] text-ink">{persona.name}</h1>
          <div className="mt-[3px] text-[13px] text-ink-4">{persona.title}</div>
          <div className="mt-[5px] font-mono text-[11.5px] text-ink-5">{persona.profile}</div>
        </div>
        <Link
          href={`/?persona=${personaSlug}`}
          className="flex-none cursor-pointer rounded-lg border border-line-3 bg-card px-[13px] py-2 text-[12px] font-semibold text-ink-2 hover:border-accent"
        >
          Filter matrix to this persona →
        </Link>
      </div>

      {/* Primary job */}
      <div
        className="mb-[18px] rounded-[10px] px-[17px] py-[15px]"
        style={{ background: colors.soft, border: `1px solid ${colors.bd}` }}
      >
        <div
          className="mb-[6px] text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: colors.color }}
        >
          Primary job to be done
        </div>
        <div className="text-[15px] font-medium leading-[1.5] text-ink">{persona.primaryJob}</div>
      </div>

      {/* Forces of Progress */}
      <div className="mb-3 flex items-center gap-[9px]">
        <h2 className="text-[14px] font-bold text-ink">Forces of Progress</h2>
        <span className="text-[11px] text-ink-5">
          the JTBD switching equation — what moves them, what holds them
        </span>
      </div>
      <div className="mb-[22px] grid grid-cols-1 gap-3 md:grid-cols-2">
        <ForceColumn
          label="Driving change  →"
          headerBg="rgba(31,157,99,0.07)"
          headerColor="#1f7d51"
          items={persona.forces.driving}
        />
        <ForceColumn
          label="←  Holding back"
          headerBg="rgba(204,59,70,0.06)"
          headerColor="#b6353f"
          items={persona.forces.holding}
        />
      </div>

      {/* Jobs / KPIs */}
      <div className="mb-[22px] grid grid-cols-1 gap-[14px] md:grid-cols-2">
        <div className="rounded-[11px] border border-line bg-card px-[17px] py-[15px]">
          <div className="mb-[11px] text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-6">
            Jobs to be done
          </div>
          <div className="flex flex-col gap-[9px]">
            {persona.jtbd.map((j, i) => (
              <div key={i} className="flex gap-[9px] text-[12.5px] leading-[1.45] text-ink-2">
                <span className="font-bold" style={{ color: colors.color }}>
                  —
                </span>
                <span>{j}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[11px] border border-line bg-card px-[17px] py-[15px]">
          <div className="mb-[11px] text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-6">
            KPIs they&rsquo;re measured on
          </div>
          <div className="flex flex-col gap-[9px]">
            {persona.kpis.map((k, i) => (
              <div key={i} className="flex gap-[9px] text-[12.5px] leading-[1.45] text-ink-2">
                <span style={{ color: colors.color }}>◆</span>
                <span>{k}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Matrix findings */}
      <div className="rounded-[11px] border border-line bg-card px-[17px] py-[15px]">
        <div className="mb-3 flex items-center gap-[9px]">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-6">
            Matrix findings impacting this persona
          </div>
          <span className="font-mono text-[11px] text-ink-7">{findings.length}</span>
        </div>
        {findings.length === 0 ? (
          <p className="text-[12px] text-ink-5">No findings recorded for this persona yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {findings.map((f) => (
              <div
                key={f.key}
                className="flex items-start gap-[10px] rounded-[7px] border border-line-2 bg-card-alt px-3 py-[10px]"
              >
                <span
                  className="mt-1 h-2 w-2 flex-none rounded-sm"
                  style={{ background: VERDICT_COLOR[f.verdict ?? "fix"] ?? "#98907f" }}
                />
                <div>
                  <div className="text-[12.5px] font-semibold text-ink">{f.title}</div>
                  {f.customerPain && (
                    <div className="mt-[2px] text-[11.5px] leading-[1.4] text-ink-4">
                      {f.customerPain}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reference documents */}
      <section className="mt-[22px]">
        <div className="mb-[10px] text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-6">
          Reference documents
        </div>
        <div className="flex flex-col gap-2">
          {persona.corpus.map((doc) => {
            const meta =
              (doc.tags.length ? doc.tags.join(" · ") : doc.slug) +
              (doc.retrievedAt ? ` · retrieved ${doc.retrievedAt}` : "");
            return (
              <details
                key={doc.slug}
                className="group overflow-hidden rounded-[10px] border border-line bg-card"
              >
                <summary className="flex cursor-pointer list-none items-center gap-[10px] px-4 py-[13px] hover:bg-card-alt [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-ink">{doc.title}</div>
                    <div className="mt-[2px] font-mono text-[10.5px] text-ink-6">{meta}</div>
                  </div>
                  <span className="flex-none text-[13px] text-ink-5 group-open:hidden">▸</span>
                  <span className="hidden flex-none text-[13px] text-ink-5 group-open:inline">▾</span>
                </summary>
                <div className="border-t border-card-subtle px-4 pb-4 pt-[2px]">
                  <div className="prose prose-sm mt-3 max-w-none text-ink-4 prose-headings:text-ink-2 prose-a:text-accent">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.body}</ReactMarkdown>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
