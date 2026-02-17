/**
 * Phase 2.0.3 constants (browser-side).
 *
 * Keep these explicit and stable: they define the consumer contract for bundle ingestion
 * and protect the dataset-freeze + versioning guarantees.
 */

// Safety guard for upcoming streaming JSONL import:
// Abort if a single JSONL line is unexpectedly huge (malformed or malicious input).
export const MAX_JSONL_LINE_BYTES = 4 * 1024 * 1024; // 4 MiB

