import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { DeliverableSchema } from "@/lib/schemas/findings";
import { renderDeliverableMarkdown, summarizeDeliverable } from "@/lib/synthesis";

const deliverable = DeliverableSchema.parse(
  JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "fixtures", "deliverable.valid.json"), "utf8"),
  ),
);

describe("renderDeliverableMarkdown", () => {
  it("renders the Prompt-1 structure", () => {
    const md = renderDeliverableMarkdown(deliverable, { runId: "test-run" });
    expect(md).toContain("## 3 Things I Like");
    expect(md).toContain("## 5 Things I Do Not Like");
    expect(md).toContain("## Kill / Fix / Double Down");
    expect(md).toContain("| Item | Verdict | Customer Pain | Persona Impacted |");
    // One table row per KFD entry.
    const rows = md.split("\n").filter((l) => l.startsWith("| ") && !l.includes("---"));
    expect(rows.length).toBe(deliverable.kfd.length + 1); // + header
    // Persona slugs are humanized.
    expect(md).toContain("Vendor Risk Manager");
    expect(md).not.toContain("gtm_cs");
  });

  it("escapes pipes and newlines in cells", () => {
    const d = structuredClone(deliverable);
    d.kfd[0].customerPain = "breaks | tables\nand lines";
    const md = renderDeliverableMarkdown(d);
    expect(md).toContain("breaks \\| tables and lines");
  });
});

describe("summarizeDeliverable", () => {
  it("counts verdicts and personas", () => {
    const s = summarizeDeliverable(deliverable);
    expect(s.kills).toBe(1);
    expect(s.fixes).toBe(3);
    expect(s.doubleDowns).toBe(1);
    expect(s.personasCovered.sort()).toEqual(["ciso", "gtm_cs", "vrm"]);
  });
});
