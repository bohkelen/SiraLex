/**
 * CF1I4 — Browser download adapter for correction-feedback export artifacts.
 *
 * Narrow injectable seams for tests. No File System Access API.
 */

export type CorrectionFeedbackExportArtifact = {
  filename: string;
  mediaType: "application/json";
  text: string;
  byteLength: number;
  draftCount: number;
  exportedAt: string;
};

export type DownloadCorrectionFeedbackDeps = {
  createObjectUrl?: (blob: Blob) => string;
  revokeObjectUrl?: (url: string) => void;
  documentRef?: Document;
};

/**
 * Trigger a browser download for a validated correction-feedback artifact.
 * Always revokes the object URL in finally.
 */
export function downloadCorrectionFeedbackArtifact(
  artifact: CorrectionFeedbackExportArtifact,
  deps: DownloadCorrectionFeedbackDeps = {},
): void {
  const documentRef = deps.documentRef ?? document;
  const createObjectUrl =
    deps.createObjectUrl ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revokeObjectUrl =
    deps.revokeObjectUrl ?? ((url: string) => URL.revokeObjectURL(url));

  const blob = new Blob([artifact.text], { type: artifact.mediaType });
  const url = createObjectUrl(blob);
  try {
    const link = documentRef.createElement("a");
    link.href = url;
    link.download = artifact.filename;
    link.rel = "noopener";
    documentRef.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    revokeObjectUrl(url);
  }
}
