import { describe, expect, it, vi } from "vitest";

import {
  buildFeedbackMailtoUrl,
  canShareFeedbackFile,
  handoffFeedbackForReview,
  isFeedbackHandoffConfigured,
  normalizeFeedbackEmail,
  resolveFeedbackEmailFromEnv,
  toFeedbackHandoffArtifact,
  type FeedbackHandoffArtifact,
  type FeedbackHandoffCopy,
} from "./feedback_handoff";

const COPY: FeedbackHandoffCopy = {
  shareTitle: "SiraLex feedback",
  shareText: "Correction feedback export",
  mailtoSubject: "SiraLex correction feedback",
  mailtoBody: "Attach file.json before sending.",
};

function artifact(
  overrides: Partial<FeedbackHandoffArtifact> = {},
): FeedbackHandoffArtifact {
  return {
    filename: "siralex-correction-feedback-2026-01-01T00-00-00Z.json",
    mimeType: "application/json",
    text: JSON.stringify({ schema: "siralex_correction_feedback_v1", drafts: [] }),
    kind: "correction_feedback",
    ...overrides,
  };
}

describe("feedback email configuration", () => {
  it("normalizes and rejects invalid addresses", () => {
    expect(normalizeFeedbackEmail("  a@b.co  ")).toBe("a@b.co");
    expect(normalizeFeedbackEmail("")).toBeUndefined();
    expect(normalizeFeedbackEmail("not-an-email")).toBeUndefined();
    expect(isFeedbackHandoffConfigured(undefined)).toBe(false);
    expect(isFeedbackHandoffConfigured("review@example.org")).toBe(true);
  });

  it("reads VITE_FEEDBACK_EMAIL without substituting a default", () => {
    expect(resolveFeedbackEmailFromEnv({})).toBeUndefined();
    expect(resolveFeedbackEmailFromEnv({ VITE_FEEDBACK_EMAIL: "" })).toBeUndefined();
    expect(resolveFeedbackEmailFromEnv({ VITE_FEEDBACK_EMAIL: " inbox@example.org " })).toBe(
      "inbox@example.org",
    );
  });
});

describe("artifact bridging", () => {
  it("accepts CF1/CF2 export artifact shape unchanged", () => {
    const text = '{"schema":"siralex_correction_feedback_v1"}';
    const bridged = toFeedbackHandoffArtifact(
      {
        filename: "pkg.json",
        mediaType: "application/json",
        text,
      },
      "correction_feedback",
    );
    expect(bridged).toEqual({
      filename: "pkg.json",
      mimeType: "application/json",
      text,
      kind: "correction_feedback",
    });
    expect(bridged?.text).toBe(text);
  });

  it("accepts search feedback kind without altering package text", () => {
    const text = '{"schema":"siralex_search_feedback_v1","items":[1]}';
    const bridged = toFeedbackHandoffArtifact(
      { filename: "sf.json", mediaType: "application/json", text },
      "search_feedback",
    );
    expect(bridged?.kind).toBe("search_feedback");
    expect(bridged?.text).toBe(text);
  });
});

describe("share capability", () => {
  it("requires canShare({ files }) support", () => {
    const file = new File(["{}"], "a.json", { type: "application/json" });
    expect(canShareFeedbackFile(file, { share: async () => undefined })).toBe(false);
    expect(
      canShareFeedbackFile(file, {
        share: async () => undefined,
        canShare: () => true,
      }),
    ).toBe(true);
    expect(
      canShareFeedbackFile(file, {
        share: async () => undefined,
        canShare: () => false,
      }),
    ).toBe(false);
  });
});

describe("mailto construction", () => {
  it("builds a pre-addressed mailto without claiming attachment", () => {
    const url = buildFeedbackMailtoUrl("review@example.org", COPY);
    expect(url.startsWith("mailto:review%40example.org?")).toBe(true);
    expect(url).toContain("subject=SiraLex%20correction%20feedback");
    expect(url).toContain("Attach%20file.json%20before%20sending.");
  });
});

describe("handoffFeedbackForReview", () => {
  it("is unavailable when email is missing", async () => {
    const result = await handoffFeedbackForReview(artifact(), {
      feedbackEmail: undefined,
      copy: COPY,
      confirmPrivacy: () => true,
    });
    expect(result).toEqual({ ok: false, reason: "unavailable_email" });
  });

  it("cancels when privacy confirmation is declined", async () => {
    const share = vi.fn();
    const download = vi.fn();
    const result = await handoffFeedbackForReview(artifact(), {
      feedbackEmail: "review@example.org",
      copy: COPY,
      confirmPrivacy: () => false,
      shareNavigator: { share, canShare: () => true },
      downloadArtifact: download,
    });
    expect(result).toEqual({ ok: false, reason: "cancelled" });
    expect(share).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
  });

  it("uses navigator.share with the governed File when supported", async () => {
    const share = vi.fn(async (_data: ShareData) => undefined);
    const download = vi.fn();
    const openMailto = vi.fn();
    const text = artifact().text;
    const result = await handoffFeedbackForReview(artifact({ text }), {
      feedbackEmail: "review@example.org",
      copy: COPY,
      confirmPrivacy: () => true,
      shareNavigator: { share, canShare: () => true },
      downloadArtifact: download,
      openMailto,
    });
    expect(result).toEqual({ ok: true, method: "share" });
    expect(share).toHaveBeenCalledTimes(1);
    const data = share.mock.calls[0]![0];
    expect(data.files).toHaveLength(1);
    const file = data.files![0]!;
    expect(file.name).toBe(artifact().filename);
    expect(file.type).toBe("application/json");
    expect(await file.text()).toBe(text);
    expect(download).not.toHaveBeenCalled();
    expect(openMailto).not.toHaveBeenCalled();
  });

  it("treats share AbortError as cancelled without download", async () => {
    const err = new Error("user cancelled");
    err.name = "AbortError";
    const share = vi.fn(async () => {
      throw err;
    });
    const download = vi.fn();
    const result = await handoffFeedbackForReview(artifact(), {
      feedbackEmail: "review@example.org",
      copy: COPY,
      confirmPrivacy: () => true,
      shareNavigator: { share, canShare: () => true },
      downloadArtifact: download,
    });
    expect(result).toEqual({ ok: false, reason: "cancelled" });
    expect(download).not.toHaveBeenCalled();
  });

  it("falls back to download + mailto when share throws a non-abort error", async () => {
    const share = vi.fn(async () => {
      throw new Error("share broken");
    });
    const download = vi.fn();
    const openMailto = vi.fn();
    const result = await handoffFeedbackForReview(artifact(), {
      feedbackEmail: "review@example.org",
      copy: COPY,
      confirmPrivacy: () => true,
      shareNavigator: { share, canShare: () => true },
      downloadArtifact: download,
      openMailto,
    });
    expect(result).toEqual({ ok: true, method: "download_mailto" });
    expect(download).toHaveBeenCalledTimes(1);
    expect(openMailto).toHaveBeenCalledTimes(1);
    expect(String(openMailto.mock.calls[0]?.[0])).toContain("mailto:review%40example.org");
  });

  it("falls back to download + mailto when file sharing is unsupported", async () => {
    const download = vi.fn();
    const openMailto = vi.fn();
    const result = await handoffFeedbackForReview(artifact(), {
      feedbackEmail: "review@example.org",
      copy: COPY,
      confirmPrivacy: () => true,
      shareNavigator: {},
      downloadArtifact: download,
      openMailto,
    });
    expect(result).toEqual({ ok: true, method: "download_mailto" });
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: artifact().filename,
        text: artifact().text,
        kind: "correction_feedback",
      }),
    );
    expect(openMailto).toHaveBeenCalled();
  });
});
