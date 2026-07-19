import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { loadPersonas, loadSharedCorpus } from "@/lib/personas";
import { PERSONAS } from "@/lib/schemas/findings";

const PERSONAS_DIR = path.join(process.cwd(), "personas");

describe("persona documentation", () => {
  it("every persona has a persona.md with the documented shape", () => {
    const personas = loadPersonas();
    expect(personas.map((p) => p.slug).sort()).toEqual([...PERSONAS].sort());
    for (const p of personas) {
      expect(p.name.length, `${p.slug} name`).toBeGreaterThan(3);
      expect(p.title.length, `${p.slug} title`).toBeGreaterThan(3);
      expect(p.companyProfile.length, `${p.slug} company_profile`).toBeGreaterThan(20);
      expect(p.jtbd.length, `${p.slug} jtbd`).toBeGreaterThanOrEqual(5);
      expect(p.kpis.length, `${p.slug} kpis`).toBeGreaterThanOrEqual(5);
      expect(p.body.length, `${p.slug} body`).toBeGreaterThan(1000);
      // The evaluation lens section the agents key off must exist.
      expect(p.body, `${p.slug} evaluation lens`).toMatch(/evaluation lens/i);
    }
  });

  it("every persona has a sourced knowledge corpus (≥3 docs)", () => {
    for (const slug of [...PERSONAS, "shared"]) {
      const dir = path.join(PERSONAS_DIR, slug, "corpus");
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
      expect(files.length, `${slug} corpus size`).toBeGreaterThanOrEqual(3);
      for (const f of files) {
        const parsed = matter(fs.readFileSync(path.join(dir, f), "utf8"));
        expect(parsed.data.title, `${slug}/${f} title`).toBeTruthy();
        expect(parsed.data.persona, `${slug}/${f} persona`).toBe(slug === "shared" ? "shared" : slug);
        expect(String(parsed.data.retrieved_at), `${slug}/${f} retrieved_at`).toMatch(
          /^\d{4}-\d{2}-\d{2}$/,
        );
        const sources = parsed.data.sources as Array<{ title: string; url: string }>;
        expect(sources?.length, `${slug}/${f} sources`).toBeGreaterThanOrEqual(2);
        for (const s of sources) {
          expect(s.url, `${slug}/${f} source url`).toMatch(/^https?:\/\//);
        }
        expect(parsed.content.length, `${slug}/${f} body`).toBeGreaterThan(800);
      }
    }
  });

  it("shared corpus loads through the app loader", () => {
    const shared = loadSharedCorpus();
    expect(shared.length).toBeGreaterThanOrEqual(3);
    expect(shared.every((d) => d.sources.length >= 2)).toBe(true);
  });
});
