/**
 * Optional catalog-side / app-side dictionary update summary (PRODUCT2E).
 * Lives outside the immutable six-file release artifact.
 */

export type DictionaryUpdateSummaryV1 = {
  schema_version?: "dictionary_update_summary_v1";
  title?: string;
  short_summary: string;
  highlights?: string[];
  /** Approximate download size when known from catalog. */
  size_bytes?: number;
  /** Previous installed identities this note is written for (informational). */
  applies_from_bundle_ids?: string[];
};

export function normalizeUpdateSummary(raw: unknown): DictionaryUpdateSummaryV1 | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  const short =
    typeof obj.short_summary === "string" && obj.short_summary.trim()
      ? obj.short_summary.trim()
      : undefined;
  if (!short) return undefined;
  const title =
    typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : undefined;
  const highlights = Array.isArray(obj.highlights)
    ? obj.highlights
        .filter((h): h is string => typeof h === "string" && h.trim().length > 0)
        .map((h) => h.trim())
    : undefined;
  const size_bytes =
    typeof obj.size_bytes === "number" && Number.isInteger(obj.size_bytes) && obj.size_bytes >= 0
      ? obj.size_bytes
      : undefined;
  const applies_from_bundle_ids = Array.isArray(obj.applies_from_bundle_ids)
    ? obj.applies_from_bundle_ids.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0,
      )
    : undefined;
  return {
    schema_version:
      obj.schema_version === "dictionary_update_summary_v1"
        ? "dictionary_update_summary_v1"
        : undefined,
    title,
    short_summary: short,
    highlights: highlights && highlights.length > 0 ? highlights : undefined,
    size_bytes,
    applies_from_bundle_ids:
      applies_from_bundle_ids && applies_from_bundle_ids.length > 0
        ? applies_from_bundle_ids
        : undefined,
  };
}

export function formatUpdateSizeLabel(sizeBytes: number | undefined, fmtBytes: (n?: number) => string): string | undefined {
  if (sizeBytes === undefined || sizeBytes < 0) return undefined;
  return fmtBytes(sizeBytes);
}
