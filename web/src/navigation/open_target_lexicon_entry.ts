/**
 * Post-LS1 — open a Maninka lexicon entry from a Source→Target index mapping
 * by stable ir_id, without re-running search.
 */

import type { SearchDirection } from "../bundle_labels";
import { getBundleStorageScopeId, type ActiveBundleMeta } from "../idb/siralex_db";
import { resolveRecords } from "../search/resolve_records";
import type { EnrichedRecord, TargetEntry } from "../types/records";
import { isLexiconDisplay } from "../types/records";

export type OpenTargetLexiconResult = "opened" | "unavailable" | "stale";

export type OpenTargetLexiconDeps = {
  target: TargetEntry;
  /** Direction to restore when the user backs out of the opened entry. */
  restoreDirection: SearchDirection;
  getActiveMeta: () => ActiveBundleMeta | undefined;
  openDb: () => Promise<IDBDatabase>;
  /** Returns false if the user navigated away while resolution was in flight. */
  isCurrent: () => boolean;
  setDirectionTargetToSource: () => void;
  openEntryDetail: (record: EnrichedRecord, restoreDirection: SearchDirection) => void;
  onUnavailable: () => void;
  /** Optional override for tests. */
  resolveRecordsFn?: typeof resolveRecords;
};

/**
 * Resolve `target.anchor` as a lexicon-entry ir_id, then switch direction and
 * open entry detail. Does not mutate search input or call search.
 */
export async function openTargetLexiconEntry(
  deps: OpenTargetLexiconDeps,
): Promise<OpenTargetLexiconResult> {
  const irId = deps.target.anchor.trim();
  if (irId === "") {
    deps.onUnavailable();
    return "unavailable";
  }

  const meta = deps.getActiveMeta();
  if (!meta) {
    deps.onUnavailable();
    return "unavailable";
  }

  const scopeId = getBundleStorageScopeId(meta);
  let db: IDBDatabase | undefined;
  let records: EnrichedRecord[];
  try {
    db = await deps.openDb();
    const resolve = deps.resolveRecordsFn ?? resolveRecords;
    records = await resolve(db, scopeId, [irId]);
  } catch {
    if (!deps.isCurrent()) return "stale";
    deps.onUnavailable();
    return "unavailable";
  } finally {
    db?.close();
  }

  if (!deps.isCurrent()) return "stale";

  const record = records[0];
  if (!record || record.ir_kind !== "lexicon_entry" || !isLexiconDisplay(record)) {
    deps.onUnavailable();
    return "unavailable";
  }

  // Commit navigation only after successful resolution.
  deps.setDirectionTargetToSource();
  if (!deps.isCurrent()) return "stale";

  deps.openEntryDetail(record, deps.restoreDirection);
  return "opened";
}

export function targetEntryHasResolvableId(target: TargetEntry): boolean {
  return target.anchor.trim() !== "";
}
