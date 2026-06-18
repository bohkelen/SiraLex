import { QUERY_LOG_CONSENT_VERSION } from "./query_log_types";

const QUERY_LOGGING_CONSENT_VERSION_KEY = "siralex.query_logging.consent_version";
const QUERY_LOGGING_CONSENT_AT_KEY = "siralex.query_logging.consent_at_iso";
const QUERY_LOGGING_SESSION_BUCKET_ID_KEY = "siralex.query_logging.session_bucket_id";

type ConsentStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function getConsentStorage(): ConsentStorage | undefined {
  try {
    if (typeof globalThis.localStorage !== "undefined") {
      return globalThis.localStorage;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function createSessionBucketId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sb-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function hasValidQueryLoggingConsent(): boolean {
  try {
    const storage = getConsentStorage();
    if (!storage) {
      return false;
    }
    return storage.getItem(QUERY_LOGGING_CONSENT_VERSION_KEY) === QUERY_LOG_CONSENT_VERSION;
  } catch {
    return false;
  }
}

export function getQueryLoggingConsentStatus(): { version?: string; atIso?: string } {
  try {
    const storage = getConsentStorage();
    if (!storage) {
      return {};
    }
    const version = storage.getItem(QUERY_LOGGING_CONSENT_VERSION_KEY) ?? undefined;
    const atIso = storage.getItem(QUERY_LOGGING_CONSENT_AT_KEY) ?? undefined;
    return { version, atIso };
  } catch {
    return {};
  }
}

export function recordQueryLoggingConsent(now: () => Date = () => new Date()): void {
  try {
    const storage = getConsentStorage();
    if (!storage) {
      return;
    }
    storage.setItem(QUERY_LOGGING_CONSENT_VERSION_KEY, QUERY_LOG_CONSENT_VERSION);
    storage.setItem(QUERY_LOGGING_CONSENT_AT_KEY, now().toISOString());
    getOrCreateSessionBucketId();
  } catch {
    // Fail closed: consent is not recorded if storage is unavailable.
  }
}

export function getOrCreateSessionBucketId(): string {
  try {
    const storage = getConsentStorage();
    if (!storage) {
      return createSessionBucketId();
    }
    const existing = storage.getItem(QUERY_LOGGING_SESSION_BUCKET_ID_KEY);
    if (existing && existing.trim() !== "") {
      return existing;
    }
    const created = createSessionBucketId();
    storage.setItem(QUERY_LOGGING_SESSION_BUCKET_ID_KEY, created);
    return created;
  } catch {
    return createSessionBucketId();
  }
}

export function clearQueryLoggingConsentForTests(): void {
  try {
    const storage = getConsentStorage();
    if (!storage) {
      return;
    }
    storage.removeItem(QUERY_LOGGING_CONSENT_VERSION_KEY);
    storage.removeItem(QUERY_LOGGING_CONSENT_AT_KEY);
    storage.removeItem(QUERY_LOGGING_SESSION_BUCKET_ID_KEY);
  } catch {
    // Ignore storage remove failures in tests.
  }
}
