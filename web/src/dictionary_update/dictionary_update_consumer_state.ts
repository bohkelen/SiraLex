/**
 * DU1 — Session-scoped consumer update UX state (no persistence).
 */

export type DictionaryUpdateConsumerPhase =
  | "idle"
  | "confirming"
  | "progress"
  | "success"
  | "failure";

export type DictionaryUpdateConsumerState = {
  phase: DictionaryUpdateConsumerPhase;
  /** Session-only: Search notice dismissed via Not now. */
  noticeDismissedThisSession: boolean;
  progressMessage: string;
  failureMessage?: string;
  cleanupWarning?: string;
};

export function createDictionaryUpdateConsumerState(): DictionaryUpdateConsumerState {
  return {
    phase: "idle",
    noticeDismissedThisSession: false,
    progressMessage: "",
  };
}

export function shouldShowSearchUpdateNotice(args: {
  updateAvailable: boolean;
  noticeDismissedThisSession: boolean;
  phase: DictionaryUpdateConsumerPhase;
}): boolean {
  if (!args.updateAvailable) return false;
  if (args.noticeDismissedThisSession) return false;
  // Keep Search usable during confirm/progress; hide notice once success clears availability.
  if (args.phase === "success") return false;
  return true;
}

export function applyNoticeDismissed(
  state: DictionaryUpdateConsumerState,
): DictionaryUpdateConsumerState {
  return { ...state, noticeDismissedThisSession: true, phase: "idle" };
}

export function beginConfirm(
  state: DictionaryUpdateConsumerState,
): DictionaryUpdateConsumerState {
  return { ...state, phase: "confirming", failureMessage: undefined, cleanupWarning: undefined };
}

export function beginProgress(
  state: DictionaryUpdateConsumerState,
  progressMessage: string,
): DictionaryUpdateConsumerState {
  return {
    ...state,
    phase: "progress",
    progressMessage,
    failureMessage: undefined,
  };
}

export function setProgressMessage(
  state: DictionaryUpdateConsumerState,
  progressMessage: string,
): DictionaryUpdateConsumerState {
  if (state.phase !== "progress") return state;
  return { ...state, progressMessage };
}

export function markUpdateSuccess(
  state: DictionaryUpdateConsumerState,
  cleanupWarning?: string,
): DictionaryUpdateConsumerState {
  return {
    ...state,
    phase: "success",
    progressMessage: "",
    failureMessage: undefined,
    cleanupWarning,
    noticeDismissedThisSession: false,
  };
}

export function markUpdateFailure(
  state: DictionaryUpdateConsumerState,
  failureMessage: string,
): DictionaryUpdateConsumerState {
  return {
    ...state,
    phase: "failure",
    progressMessage: "",
    failureMessage,
  };
}

export function closeUpdateUi(
  state: DictionaryUpdateConsumerState,
): DictionaryUpdateConsumerState {
  return {
    ...state,
    phase: "idle",
    progressMessage: "",
    failureMessage: undefined,
    cleanupWarning: undefined,
  };
}

/** Consumer progress stage ids mapped from the install lifecycle. */
export type DictionaryUpdateProgressStage =
  | "preparing"
  | "downloading"
  | "verifying"
  | "installing"
  | "cleanup"
  | "complete";

export function mapInstallLifecycleToConsumerStage(
  technicalHint: string,
): DictionaryUpdateProgressStage {
  const h = technicalHint.toLowerCase();
  if (h.includes("cleanup") || h.includes("previous bundle") || h.includes("removing")) {
    return "cleanup";
  }
  if (h.includes("commit") || h.includes("installing new") || h.includes("staging")) {
    return "installing";
  }
  if (
    h.includes("manifest") ||
    h.includes("verif") ||
    h.includes("checksum") ||
    h.includes("checking")
  ) {
    return "verifying";
  }
  if (h.includes("fetch") || h.includes("download") || h.includes("records") || h.includes("search_index")) {
    return "downloading";
  }
  if (h.includes("complete") || h.includes("updated") || h.includes("ready")) {
    return "complete";
  }
  return "preparing";
}
