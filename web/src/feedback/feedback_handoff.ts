/**
 * FH1 — Transport-only feedback review handoff.
 *
 * Moves an already-governed CF1/CF2 export artifact. Does not reinterpret
 * package semantics, mutate drafts, or claim delivery/receipt.
 */

export type FeedbackHandoffKind = "correction_feedback" | "search_feedback";

export type FeedbackHandoffArtifact = {
  filename: string;
  mimeType: "application/json";
  text: string;
  kind: FeedbackHandoffKind;
};

export type FeedbackHandoffCopy = {
  shareTitle: string;
  shareText: string;
  mailtoSubject: string;
  mailtoBody: string;
};

export type FeedbackHandoffSuccessMethod = "share" | "download_mailto";

export type FeedbackHandoffResult =
  | { ok: true; method: FeedbackHandoffSuccessMethod }
  | {
      ok: false;
      reason:
        | "unavailable_email"
        | "cancelled"
        | "share_failed"
        | "download_failed"
        | "invalid_artifact";
    };

export type FeedbackHandoffShareNavigator = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

export type FeedbackHandoffDeps = {
  /** Configured review inbox. Empty/missing disables handoff. */
  feedbackEmail?: string | null;
  copy: FeedbackHandoffCopy;
  /** Confirm privacy transition. Return false to cancel. */
  confirmPrivacy: () => boolean | Promise<boolean>;
  shareNavigator?: FeedbackHandoffShareNavigator;
  createFile?: (parts: BlobPart[], filename: string, options?: FilePropertyBag) => File;
  downloadArtifact?: (artifact: FeedbackHandoffArtifact) => void;
  openMailto?: (url: string) => void;
};

export function normalizeFeedbackEmail(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  // Minimal sanity: require one @ with local + domain material. Not full RFC validation.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return undefined;
  return trimmed;
}

export function resolveFeedbackEmailFromEnv(
  env: { VITE_FEEDBACK_EMAIL?: string } | undefined = typeof import.meta !== "undefined"
    ? (import.meta.env as { VITE_FEEDBACK_EMAIL?: string })
    : undefined,
): string | undefined {
  return normalizeFeedbackEmail(env?.VITE_FEEDBACK_EMAIL);
}

export function isFeedbackHandoffConfigured(
  feedbackEmail: string | null | undefined = resolveFeedbackEmailFromEnv(),
): boolean {
  return normalizeFeedbackEmail(feedbackEmail) !== undefined;
}

export function toFeedbackHandoffArtifact(
  artifact: {
    filename: string;
    mediaType?: string;
    mimeType?: string;
    text: string;
  },
  kind: FeedbackHandoffKind,
): FeedbackHandoffArtifact | undefined {
  const mimeType = artifact.mimeType ?? artifact.mediaType;
  if (mimeType !== "application/json") return undefined;
  if (typeof artifact.filename !== "string" || artifact.filename.trim() === "") return undefined;
  if (typeof artifact.text !== "string") return undefined;
  return {
    filename: artifact.filename,
    mimeType: "application/json",
    text: artifact.text,
    kind,
  };
}

export function canShareFeedbackFile(
  file: File,
  shareNavigator: FeedbackHandoffShareNavigator = typeof navigator !== "undefined" ? navigator : {},
): boolean {
  if (typeof shareNavigator.share !== "function") return false;
  if (typeof shareNavigator.canShare !== "function") {
    // Some browsers expose share without canShare; attempt share path only when canShare exists
    // for files, otherwise fall back to download+mailto (safer than claiming share support).
    return false;
  }
  try {
    return shareNavigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function buildFeedbackMailtoUrl(
  email: string,
  copy: Pick<FeedbackHandoffCopy, "mailtoSubject" | "mailtoBody">,
): string {
  const params = new URLSearchParams();
  params.set("subject", copy.mailtoSubject);
  params.set("body", copy.mailtoBody);
  // URLSearchParams encodes spaces as '+'; mailto bodies expect %20.
  const query = params.toString().replace(/\+/g, "%20");
  return `mailto:${encodeURIComponent(email)}?${query}`;
}

function defaultCreateFile(
  parts: BlobPart[],
  filename: string,
  options?: FilePropertyBag,
): File {
  return new File(parts, filename, options);
}

function defaultOpenMailto(url: string): void {
  if (typeof window === "undefined") return;
  window.location.assign(url);
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String((err as { name?: unknown }).name) : "";
  return name === "AbortError";
}

/**
 * Hand off a governed feedback artifact for external review.
 * Never mutates local draft rows. Success means prepared/shared locally — not received.
 */
export async function handoffFeedbackForReview(
  artifact: FeedbackHandoffArtifact,
  deps: FeedbackHandoffDeps,
): Promise<FeedbackHandoffResult> {
  if (
    !artifact ||
    artifact.mimeType !== "application/json" ||
    typeof artifact.filename !== "string" ||
    artifact.filename.trim() === "" ||
    typeof artifact.text !== "string"
  ) {
    return { ok: false, reason: "invalid_artifact" };
  }

  const email = normalizeFeedbackEmail(deps.feedbackEmail);
  if (!email) {
    return { ok: false, reason: "unavailable_email" };
  }

  const confirmed = await deps.confirmPrivacy();
  if (!confirmed) {
    return { ok: false, reason: "cancelled" };
  }

  const createFile = deps.createFile ?? defaultCreateFile;
  const shareNavigator =
    deps.shareNavigator ?? (typeof navigator !== "undefined" ? navigator : {});
  const downloadArtifact = deps.downloadArtifact;
  const openMailto = deps.openMailto ?? defaultOpenMailto;

  const file = createFile([artifact.text], artifact.filename, {
    type: artifact.mimeType,
  });

  if (canShareFeedbackFile(file, shareNavigator) && typeof shareNavigator.share === "function") {
    try {
      await shareNavigator.share({
        files: [file],
        title: deps.copy.shareTitle,
        text: deps.copy.shareText,
      });
      return { ok: true, method: "share" };
    } catch (err) {
      if (isAbortError(err)) {
        return { ok: false, reason: "cancelled" };
      }
      // Fall through to download + mailto.
    }
  }

  if (typeof downloadArtifact !== "function") {
    return { ok: false, reason: "download_failed" };
  }

  try {
    downloadArtifact(artifact);
  } catch {
    return { ok: false, reason: "download_failed" };
  }

  openMailto(buildFeedbackMailtoUrl(email, deps.copy));
  return { ok: true, method: "download_mailto" };
}
