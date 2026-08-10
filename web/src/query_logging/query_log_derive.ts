import {
  isValidLookupMode,
  lookupModeFromLegacySearchDirection,
  toLegacySearchDirection,
  type LookupMode,
} from "../search/lookup_mode";
import {
  QUERY_LOG_EVENT_V2,
  QUERY_LOG_EVENT_V3,
  type QueryLogEvent,
  type QueryLogEventV1,
  type QueryLogEventV2,
  type QueryLogEventV3,
  type QueryLogLadderLevel,
  type QueryLogLookupLanguage,
  type QueryLogResultStatus,
} from "./query_log_types";

export function deriveResultStatus(resultCount: number): QueryLogResultStatus {
  if (!Number.isInteger(resultCount) || resultCount < 0) {
    throw new Error("deriveResultStatus: resultCount must be an integer >= 0");
  }
  if (resultCount === 0) {
    return "miss";
  }
  if (resultCount === 1) {
    return "hit_single";
  }
  return "hit_multi";
}

export function deriveMatchedDeepLadder(matchedKeyType: QueryLogLadderLevel): boolean {
  return matchedKeyType === "punct_stripped" || matchedKeyType === "nospace";
}

export function isQueryLogEventV2(row: unknown): row is QueryLogEventV2 {
  if (typeof row !== "object" || row === null) {
    return false;
  }
  return (row as QueryLogEventV2).schema_version === QUERY_LOG_EVENT_V2;
}

export function isQueryLogEventV3(row: unknown): row is QueryLogEventV3 {
  if (typeof row !== "object" || row === null) {
    return false;
  }
  return (row as QueryLogEventV3).schema_version === QUERY_LOG_EVENT_V3;
}

/** V2 and V3 share modern result-field shape (excluding V3 language pair). */
export function isModernQueryLogEvent(row: unknown): row is QueryLogEventV2 | QueryLogEventV3 {
  return isQueryLogEventV2(row) || isQueryLogEventV3(row);
}

export function getQueryLogResultCount(row: QueryLogEventV1 | QueryLogEventV2 | QueryLogEventV3): number {
  if (isModernQueryLogEvent(row)) {
    return row.result_count;
  }
  return row.ir_ids_count;
}

export function getQueryLogStatusLabel(
  row: QueryLogEventV1 | QueryLogEventV2 | QueryLogEventV3,
): QueryLogResultStatus {
  if (isModernQueryLogEvent(row)) {
    return row.result_status;
  }
  return deriveResultStatus(row.ir_ids_count);
}

export function getQueryLogMatchedKeyType(
  row: QueryLogEventV1 | QueryLogEventV2 | QueryLogEventV3,
): QueryLogLadderLevel {
  if (isModernQueryLogEvent(row)) {
    return row.matched_key_type;
  }
  return row.ladder_level_hit;
}

export function getQueryLogMatchedKey(
  row: QueryLogEventV1 | QueryLogEventV2 | QueryLogEventV3,
): string | null {
  if (isModernQueryLogEvent(row)) {
    return row.matched_key;
  }
  return null;
}

const LOOKUP_LANG_LABEL: Record<QueryLogLookupLanguage, string> = {
  fr: "FR",
  en: "EN",
  mnk: "MNK",
};

export function formatLookupModeDisplay(mode: LookupMode): string {
  return `${LOOKUP_LANG_LABEL[mode.from]} → ${LOOKUP_LANG_LABEL[mode.to]}`;
}

/**
 * Resolve LookupMode from a stored query-log row.
 * V3: explicit input_lang/output_lang.
 * V1/V2 historical: direction → FR↔MNK only (EN was never exposed).
 */
export function resolveLookupModeFromQueryLog(row: QueryLogEvent): LookupMode {
  if (isQueryLogEventV3(row)) {
    const mode = { from: row.input_lang, to: row.output_lang };
    if (!isValidLookupMode(mode)) {
      // Fail closed to historical FR↔MNK mirror rather than surfacing undefined.
      return lookupModeFromLegacySearchDirection(row.direction);
    }
    if (toLegacySearchDirection(mode) !== row.direction) {
      return lookupModeFromLegacySearchDirection(row.direction);
    }
    return mode;
  }
  return lookupModeFromLegacySearchDirection(row.direction);
}

export function recentLogLookupPairDisplay(row: QueryLogEvent): string {
  return formatLookupModeDisplay(resolveLookupModeFromQueryLog(row));
}
