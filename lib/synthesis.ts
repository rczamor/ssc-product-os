import type { Deliverable, PersonaSlug } from "./schemas/findings";
import { PERSONA_LABELS, ROOT_CAUSE_LABELS, VERDICT_LABELS } from "./schemas/findings";

function personaList(personas: PersonaSlug[]): string {
  return personas.map((p) => PERSONA_LABELS[p]).join(", ");
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
}

/**
 * Renders the Prompt-1 deliverable exactly in the shape the take-home asks
 * for: 3 likes, 5 dislikes, and a Kill / Fix / Double-Down table where each
 * issue states customer pain, persona impacted, root cause type, effort, and
 * first action this week.
 */
export function renderDeliverableMarkdown(d: Deliverable, opts?: { runId?: string }): string {
  const lines: string[] = [];
  lines.push("# SecurityScorecard Platform Review — Persona Evaluation");
  if (opts?.runId) lines.push("", `_Run: ${opts.runId}_`);

  lines.push("", "## 3 Things I Like", "");
  d.likes.forEach((like, i) => {
    lines.push(`${i + 1}. **${like.title}** _(${personaList(like.personas)})_`, `   ${like.detail}`);
  });

  lines.push("", "## 5 Things I Do Not Like", "");
  d.dislikes.forEach((dis, i) => {
    lines.push(
      `${i + 1}. **${dis.title}** _(${personaList(dis.personas)})_`,
      `   ${dis.detail}`,
      `   - Customer pain: ${dis.customerPain}`,
      `   - Root cause: ${ROOT_CAUSE_LABELS[dis.rootCause]} · Effort: ${dis.effort} · First action this week: ${dis.firstAction}`,
    );
  });

  lines.push(
    "",
    "## Kill / Fix / Double Down",
    "",
    "| Item | Verdict | Customer Pain | Persona Impacted | Root Cause | Effort | First Action This Week |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const row of d.kfd) {
    lines.push(
      `| ${escapeCell(row.item)} | ${VERDICT_LABELS[row.verdict]} | ${escapeCell(row.customerPain)} | ${personaList(row.personas)} | ${ROOT_CAUSE_LABELS[row.rootCause]} | ${row.effort} | ${escapeCell(row.firstAction)} |`,
    );
  }

  return lines.join("\n") + "\n";
}

/** Quick stats for dashboards and run summaries. */
export function summarizeDeliverable(d: Deliverable): {
  kills: number;
  fixes: number;
  doubleDowns: number;
  personasCovered: PersonaSlug[];
} {
  const personas = new Set<PersonaSlug>();
  for (const row of d.kfd) row.personas.forEach((p) => personas.add(p));
  d.likes.forEach((l) => l.personas.forEach((p) => personas.add(p)));
  d.dislikes.forEach((l) => l.personas.forEach((p) => personas.add(p)));
  return {
    kills: d.kfd.filter((r) => r.verdict === "kill").length,
    fixes: d.kfd.filter((r) => r.verdict === "fix").length,
    doubleDowns: d.kfd.filter((r) => r.verdict === "double_down").length,
    personasCovered: [...personas],
  };
}
