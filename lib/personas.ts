import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { PERSONAS, type PersonaSlug } from "./schemas/findings";

export interface CorpusDoc {
  slug: string;
  title: string;
  persona: string;
  tags: string[];
  sources: Array<{ title: string; url: string }>;
  retrievedAt: string;
  body: string;
}

/** A single "Forces of Progress" item rendered on the Persona Detail view. */
export type Force = { icon: string; key: string; text: string };

export interface PersonaDoc {
  slug: PersonaSlug;
  name: string;
  title: string;
  companyProfile: string;
  jtbd: string[];
  kpis: string[];
  /** One curated sentence naming the persona's single most important JTBD. */
  primaryJob: string;
  /** Short one-line descriptor for a monospace subtitle. */
  profile: string;
  /** Forces of Progress: what pushes toward vs. holds back adoption/expansion. */
  forces: { driving: Force[]; holding: Force[] };
  /** ISO date the persona knowledge base was established (front-matter). */
  created: string | null;
  body: string;
  corpus: CorpusDoc[];
}

const PERSONAS_DIR = path.join(process.cwd(), "personas");

/**
 * YAML list items like `- Product adoption: 80% of accounts` parse as
 * single-key objects rather than strings; flatten everything to strings.
 */
function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      return Object.entries(item as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join("; ");
    }
    return String(item);
  });
}

/**
 * Normalize a front-matter date to a plain YYYY-MM-DD string. Unquoted YAML
 * dates (`created: 2026-07-19`) parse as JS `Date` objects, whose `String()`
 * form is a verbose, timezone-shifted datetime (off-by-one in negative offsets).
 * Coerce both a Date and a string to the ISO date, taking the UTC calendar day.
 */
function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value).trim();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

/**
 * Parse a front-matter list of `{ icon, key, text }` mappings into Force[].
 * Non-object or missing entries are dropped; missing keys become empty strings.
 */
function toForceList(value: unknown): Force[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const rec = item as Record<string, unknown>;
    return [
      {
        icon: String(rec.icon ?? ""),
        key: String(rec.key ?? ""),
        text: String(rec.text ?? ""),
      },
    ];
  });
}

/** Parse the `forces` front-matter object; absent/malformed → empty arrays. */
function toForces(value: unknown): { driving: Force[]; holding: Force[] } {
  const rec =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    driving: toForceList(rec.driving),
    holding: toForceList(rec.holding),
  };
}

function readCorpusDir(dir: string): CorpusDoc[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const parsed = matter(fs.readFileSync(path.join(dir, f), "utf8"));
      return {
        slug: f.replace(/\.md$/, ""),
        title: String(parsed.data.title ?? f),
        persona: String(parsed.data.persona ?? ""),
        tags: (parsed.data.tags ?? []) as string[],
        sources: (parsed.data.sources ?? []) as Array<{ title: string; url: string }>,
        retrievedAt: String(parsed.data.retrieved_at ?? ""),
        body: parsed.content,
      };
    });
}

/** Loads the documented personas + their corpus from the repo (server-only). */
export function loadPersonas(): PersonaDoc[] {
  return PERSONAS.filter((slug) =>
    fs.existsSync(path.join(PERSONAS_DIR, slug, "persona.md")),
  ).map((slug) => {
    const parsed = matter(
      fs.readFileSync(path.join(PERSONAS_DIR, slug, "persona.md"), "utf8"),
    );
    const jtbd = toStringList(parsed.data.jtbd);
    const title = String(parsed.data.title ?? "");
    const companyProfile = String(parsed.data.company_profile ?? "");
    return {
      slug,
      name: String(parsed.data.name ?? slug),
      title,
      companyProfile,
      jtbd,
      kpis: toStringList(parsed.data.kpis),
      // Fallback: first JTBD when no curated primary_job is present.
      primaryJob: String(parsed.data.primary_job ?? "") || jtbd[0] || "",
      // Fallback: truncated title, else company profile.
      profile:
        String(parsed.data.profile ?? "") ||
        (title || companyProfile).slice(0, 80),
      forces: toForces(parsed.data.forces),
      created: toIsoDate(parsed.data.created),
      body: parsed.content,
      corpus: readCorpusDir(path.join(PERSONAS_DIR, slug, "corpus")),
    };
  });
}

export function loadSharedCorpus(): CorpusDoc[] {
  return readCorpusDir(path.join(PERSONAS_DIR, "shared", "corpus"));
}
