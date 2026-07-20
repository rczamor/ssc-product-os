"use client";

import { useState } from "react";

export interface FeedbackSourceChip {
  source: string;
  label: string;
  kind: "scraped" | "connector";
  connected: boolean;
  count: number;
}

/** Per-connector copy for the (non-functional) Connect stub panel. */
const CONNECT_META: Record<string, { note: string; placeholder: string }> = {
  g2: { note: "review site · OAuth", placeholder: "Workspace URL" },
  trustradius: { note: "review site · API", placeholder: "API key" },
  peerspot: { note: "review aggregator · API", placeholder: "API key" },
  pendo: { note: "product telemetry · API", placeholder: "Integration key" },
  gong: { note: "call intelligence · OAuth", placeholder: "Workspace URL" },
  gainsight: { note: "CS health & plays · API", placeholder: "API key" },
  snowflake: { note: "usage warehouse · reader", placeholder: "Account · warehouse" },
};

/**
 * The Planning screen's FEEDBACK SOURCES row: a compact chip row of connected
 * (scraped) sources with live counts, plus available-but-not-connected connector
 * targets that each expose a "+" opening a stub Connect panel. The panel is
 * intentionally non-functional — this app ingests read-only; connecting is a
 * design placeholder that marks the chip "syncing…" locally without persisting.
 */
export default function FeedbackSources({
  sources,
  updatedLabel,
}: {
  sources: FeedbackSourceChip[];
  updatedLabel: string;
}) {
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [localConnected, setLocalConnected] = useState<Record<string, boolean>>({});

  const cfg = configuring
    ? {
        source: configuring,
        label: sources.find((s) => s.source === configuring)?.label ?? configuring,
        ...(CONNECT_META[configuring] ?? { note: "connector", placeholder: "Credential" }),
      }
    : null;

  return (
    <section className="mb-[14px] rounded-[10px] border border-line-2 bg-card-alt px-[14px] py-[10px]">
      <div className="flex flex-wrap items-center gap-[9px]">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-6">
          Feedback sources
        </span>

        {sources.map((s) => {
          if (s.connected) {
            return (
              <span
                key={s.source}
                className="inline-flex items-center gap-[6px] rounded-[7px] bg-card px-[10px] py-1 text-[11.5px] text-ink-2"
                style={{ border: "1px solid rgba(31,157,99,0.32)" }}
              >
                <span className="h-[6px] w-[6px] rounded-full" style={{ background: "#1f9d63" }} />
                {s.label} <span className="font-mono font-semibold">{s.count}</span>{" "}
                <span className="text-ink-5">{s.kind === "scraped" ? "scraped" : "synced"}</span>
              </span>
            );
          }
          if (localConnected[s.source]) {
            return (
              <span
                key={s.source}
                className="inline-flex items-center gap-[6px] rounded-[7px] bg-card px-[10px] py-1 text-[11.5px] text-ink-2"
                style={{ border: "1px solid rgba(176,119,20,0.35)" }}
              >
                <span className="h-[6px] w-[6px] rounded-full" style={{ background: "#b07714" }} />
                {s.label}{" "}
                <span className="font-mono text-[10.5px] text-amber-dark">syncing…</span>
              </span>
            );
          }
          return (
            <span
              key={s.source}
              className="inline-flex items-center gap-1 rounded-[7px] border border-line bg-card py-[3px] pl-[10px] pr-1 text-[11.5px] text-ink-5"
            >
              {s.label}
              <button
                type="button"
                title="Configure integration"
                onClick={() => setConfiguring(s.source)}
                className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-[5px] border border-line bg-card-alt font-sans text-[14px] leading-none text-ink-4 hover:border-accent hover:text-accent"
              >
                +
              </button>
            </span>
          );
        })}

        <span className="ml-auto font-mono text-[11px] text-ink-7">updated {updatedLabel}</span>
      </div>

      {cfg && (
        <div
          className="mt-[11px] max-w-[560px] rounded-[9px] border bg-card px-[14px] py-[13px]"
          style={{ borderColor: "var(--accent-bd)" }}
        >
          <div className="mb-[3px] flex items-center gap-2">
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-[5px] text-[13px] font-bold"
              style={{ background: "var(--accent-bg)", color: "var(--accent)" }}
            >
              +
            </span>
            <span className="text-[13px] font-semibold text-ink">Connect {cfg.label}</span>
            <span className="text-[11px] text-ink-5">{cfg.note}</span>
          </div>
          <div className="my-[6px] mb-[10px] text-[11px] text-ink-5">
            Read-only ingestion — the connector pulls feedback in; it never writes back to the
            source.
          </div>
          <div className="flex items-center gap-2">
            <input
              placeholder={cfg.placeholder}
              className="min-w-0 flex-1 rounded-[7px] border border-line bg-card-alt px-[10px] py-[7px] font-mono text-[11.5px] text-ink-2 outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => {
                setLocalConnected((c) => ({ ...c, [cfg.source]: true }));
                setConfiguring(null);
              }}
              className="cursor-pointer rounded-[7px] bg-accent px-[15px] py-2 text-[12px] font-semibold text-white hover:brightness-[1.08]"
            >
              Connect
            </button>
            <button
              type="button"
              onClick={() => setConfiguring(null)}
              className="cursor-pointer border-none bg-transparent px-[10px] py-2 text-[12px] text-ink-5 hover:text-ink-2"
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
