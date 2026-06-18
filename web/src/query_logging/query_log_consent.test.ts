import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearQueryLoggingConsentForTests,
  getOrCreateSessionBucketId,
  getQueryLoggingConsentStatus,
  hasValidQueryLoggingConsent,
  recordQueryLoggingConsent,
} from "./query_log_consent";
import { QUERY_LOG_CONSENT_VERSION } from "./query_log_types";

type MemoryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
};

function createMemoryStorage(): MemoryStorage {
  const map = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return map.has(key) ? map.get(key) ?? null : null;
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
    },
    removeItem(key: string): void {
      map.delete(key);
    },
    clear(): void {
      map.clear();
    },
  };
}

describe("query log consent", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("localStorage", createMemoryStorage());
    clearQueryLoggingConsentForTests();
  });

  it("treats missing stored consent as invalid", () => {
    expect(hasValidQueryLoggingConsent()).toBe(false);
    expect(getQueryLoggingConsentStatus()).toEqual({});
  });

  it("records consent with current version and timestamp", () => {
    const now = () => new Date("2026-06-18T12:00:00.000Z");

    recordQueryLoggingConsent(now);

    expect(hasValidQueryLoggingConsent()).toBe(true);
    expect(getQueryLoggingConsentStatus()).toEqual({
      version: QUERY_LOG_CONSENT_VERSION,
      atIso: "2026-06-18T12:00:00.000Z",
    });
  });

  it("treats stale stored consent version as invalid", () => {
    localStorage.setItem("siralex.query_logging.consent_version", "phase7k_tester_consent_v0");
    localStorage.setItem("siralex.query_logging.consent_at_iso", "2026-01-01T00:00:00.000Z");

    expect(hasValidQueryLoggingConsent()).toBe(false);
  });

  it("creates a session bucket id", () => {
    const bucket = getOrCreateSessionBucketId();
    expect(bucket.trim()).not.toBe("");
    expect(localStorage.getItem("siralex.query_logging.session_bucket_id")).toBe(bucket);
  });

  it("keeps session bucket stable across calls", () => {
    const first = getOrCreateSessionBucketId();
    const second = getOrCreateSessionBucketId();
    expect(second).toBe(first);
  });

  it("creates session bucket when consent is recorded", () => {
    recordQueryLoggingConsent(() => new Date("2026-06-18T12:00:00.000Z"));
    const bucket = localStorage.getItem("siralex.query_logging.session_bucket_id");
    expect(bucket).toBeTruthy();
    expect(getOrCreateSessionBucketId()).toBe(bucket);
  });

  it("clearQueryLoggingConsentForTests clears consent and session state", () => {
    recordQueryLoggingConsent(() => new Date("2026-06-18T12:00:00.000Z"));
    getOrCreateSessionBucketId();

    clearQueryLoggingConsentForTests();

    expect(hasValidQueryLoggingConsent()).toBe(false);
    expect(getQueryLoggingConsentStatus()).toEqual({});
    expect(localStorage.getItem("siralex.query_logging.session_bucket_id")).toBeNull();
  });

  it("uses timestamp fallback when crypto.randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", undefined);

    const bucket = getOrCreateSessionBucketId();

    expect(bucket.startsWith("sb-")).toBe(true);
  });

  it("fails closed when localStorage access throws", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("storage unavailable");
      },
      setItem() {
        throw new Error("storage unavailable");
      },
      removeItem() {
        throw new Error("storage unavailable");
      },
      clear() {
        throw new Error("storage unavailable");
      },
    });

    expect(hasValidQueryLoggingConsent()).toBe(false);
    expect(getQueryLoggingConsentStatus()).toEqual({});
    expect(() => recordQueryLoggingConsent()).not.toThrow();
    expect(hasValidQueryLoggingConsent()).toBe(false);
    const bucket = getOrCreateSessionBucketId();
    expect(bucket.trim()).not.toBe("");
  });
});
