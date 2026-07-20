"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FridayUpdate as FridayUpdateData } from "@/lib/schemas/friday";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Fri · Jul 24 2026 · 4:30pm" — UTC-deterministic to avoid hydration drift. */
function fmtGeneratedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  let h = d.getUTCHours();
  const ap = h < 12 ? "am" : "pm";
  h = h % 12 || 12;
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${DAYS[d.getUTCDay()]} · ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${d.getUTCFullYear()} · ${h}:${mm}${ap}`;
}

function pct(v: number | null): string {
  return v == null ? "—" : `${v.toFixed(0)}%`;
}

function Divider({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-line-2 py-[14px]">{children}</div>;
}

export default function FridayUpdate({
  open,
  onClose,
  update: initial,
  boardLastSyncedAt,
}: {
  open: boolean;
  onClose: () => void;
  update: FridayUpdateData | null;
  boardLastSyncedAt: string | null;
}) {
  const router = useRouter();
  const [update, setUpdate] = useState<FridayUpdateData | null>(initial);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
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
  }, [router]);

  // Auto-generate the first time the slide-over opens with no cached update.
  useEffect(() => {
    if (open && !update && !generating && !error) void generate();
  }, [open, update, generating, error, generate]);

  if (!open) return null;

  const subline = update
    ? `weekly cadence · generated ${fmtGeneratedAt(update.generatedAt)}`
    : generating
      ? "weekly cadence · generating…"
      : "weekly cadence";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[40] flex justify-end bg-[rgba(38,32,25,0.4)] backdrop-blur-[2px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="h-full w-[540px] max-w-[92vw] overflow-y-auto border-l border-line bg-card shadow-panel animate-fadeup-fast"
      >
        {/* Sticky header */}
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line-2 bg-card px-5 py-[18px]">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-[7px] w-[7px] rounded-full bg-amber" />
              <h2 className="m-0 text-[15px] font-bold text-ink">Product &amp; Engineering Update</h2>
            </div>
            <div className="mt-[3px] font-mono text-[11.5px] text-ink-5">{subline}</div>
          </div>
          <button
            onClick={onClose}
            className="flex h-[26px] w-[26px] flex-none cursor-pointer items-center justify-center rounded-[6px] border border-line bg-card-alt text-[14px] text-ink-4"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pt-[6px] pb-[40px]">
          {error && <p className="py-3 text-[12px] text-red">{error}</p>}

          {!update ? (
            <p className="py-6 text-[12.5px] text-ink-5">
              {generating ? "Generating the Friday Update from the live board…" : "No update yet."}
            </p>
          ) : (
            <>
              {/* Shipped */}
              <Divider>
                <div className="mb-[9px] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-green-dark">
                  Shipped
                </div>
                {update.shipped.length === 0 ? (
                  <p className="text-[12.5px] text-ink-5">Nothing moved to Done this window.</p>
                ) : (
                  <div className="flex flex-col gap-[7px]">
                    {update.shipped.map((s) => (
                      <div key={s.identifier} className="flex gap-2 text-[12.5px] leading-[1.45] text-ink-2">
                        <span className="flex-none font-mono text-green-mid">{s.identifier}</span>
                        <span>{s.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Divider>

              {/* Slipped */}
              <Divider>
                <div className="mb-[9px] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-red-dark">
                  Slipped
                </div>
                {update.slipped.length === 0 ? (
                  <p className="text-[12.5px] text-ink-5">Nothing is past due.</p>
                ) : (
                  <div className="flex flex-col gap-[7px]">
                    {update.slipped.map((s) => (
                      <div key={s.identifier} className="flex gap-2 text-[12.5px] leading-[1.45] text-ink-2">
                        <span className="flex-none font-mono text-red">{s.identifier}</span>
                        <span>
                          {s.title} <span className="text-ink-5">· {s.daysLate}d late</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Divider>

              {/* 2x2 grid */}
              <Divider>
                <div className="grid grid-cols-2 gap-x-[18px] gap-y-[14px]">
                  <GridCell label="Customer impact" body={update.customerImpact} />
                  <GridCell label="Adoption" body={update.adoption} />
                  <GridCell label="Velocity" body={update.velocity} />
                  <GridCell label="Risks" body={update.risks.join(" ")} />
                </div>
              </Divider>

              {/* AI usage */}
              <Divider>
                <div className="mb-[9px] text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-6">
                  AI usage
                </div>
                <div className="flex gap-[9px]">
                  <StatTile value={pct(update.aiUsage.containmentRatePercent)} color="#cc3b46" sub="containment" />
                  <StatTile value={String(update.aiUsage.workflowsRunCount)} color="#5a5142" sub="workflows run" />
                  <StatTile value={pct(update.aiUsage.agreeRatePercent)} color="#1f9d63" sub="human agree-rate" />
                </div>
              </Divider>

              {/* One win */}
              <div className="py-[14px]">
                <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-amber-dark">
                  One win to celebrate 🎉
                </div>
                <div className="rounded-[8px] border border-[rgba(176,119,20,0.2)] bg-[rgba(176,119,20,0.06)] px-[14px] py-3 text-[13px] leading-[1.55] text-ink-2">
                  {update.oneWin}
                </div>
              </div>

              {boardLastSyncedAt && (
                <p className="text-[10.5px] text-ink-6">Reflects the board as of last sync.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GridCell({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div className="mb-[5px] text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-6">{label}</div>
      <div className="text-[12px] leading-[1.5] text-ink-4">{body}</div>
    </div>
  );
}

function StatTile({ value, color, sub }: { value: string; color: string; sub: string }) {
  return (
    <div className="flex-1 rounded-[8px] border border-line-2 bg-card-alt p-[11px] text-center">
      <div className="font-mono text-[19px] font-bold" style={{ color }}>
        {value}
      </div>
      <div className="mt-[2px] text-[10px] text-ink-5">{sub}</div>
    </div>
  );
}
