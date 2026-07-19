const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True for a canonical UUID string. Route handlers guard path params with this
 * so a non-UUID id returns 404/notFound instead of letting Postgres raise
 * "invalid input syntax for type uuid" (22P02) as an unhandled 500.
 */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** "YYYY-MM-DD HH:MM" for a timestamp column (Date from either DB driver). */
export function formatTimestamp(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16).replace("T", " ");
}
