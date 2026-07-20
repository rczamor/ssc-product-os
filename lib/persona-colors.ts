import type { PersonaSlug } from "@/lib/schemas/findings";

/**
 * Per-persona color triples for inline-style binding (A16). The design uses the
 * solid `color` for dots/squares/bullets, `soft` for tinted card fills, and `bd`
 * for tinted borders. Mirrors the `.persona-*` CSS classes in globals.css but as
 * values, so they can drive dynamic inline styles (e.g. a persona-tinted card).
 */
export const PERSONA_COLORS: Record<PersonaSlug, { color: string; soft: string; bd: string }> = {
  ciso: { color: "#2b5bd7", soft: "rgba(43,91,215,0.07)", bd: "rgba(43,91,215,0.28)" },
  vrm: { color: "#1f9d63", soft: "rgba(31,157,99,0.07)", bd: "rgba(31,157,99,0.28)" },
  gtm_cs: { color: "#6d4bd0", soft: "rgba(109,75,208,0.07)", bd: "rgba(109,75,208,0.28)" },
};

/** Short nav/chip labels (distinct from the long PERSONA_LABELS). */
export const PERSONA_SHORT: Record<PersonaSlug, string> = {
  ciso: "CISO",
  vrm: "VRM",
  gtm_cs: "GTM/CS",
};

export function personaColor(slug: string): { color: string; soft: string; bd: string } {
  return PERSONA_COLORS[slug as PersonaSlug] ?? { color: "#98907f", soft: "rgba(152,144,127,0.07)", bd: "rgba(152,144,127,0.28)" };
}
