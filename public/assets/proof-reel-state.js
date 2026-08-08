// SPDX-License-Identifier: Apache-2.0

export const PROBLEM_AUTOMATION_DELAY_MS = 5000;
export const CONTINUITY_PRELUDE_DELAY_MS = 1800;

export function boundedChapter(index, chapterCount) {
  return Math.max(0, Math.min(index, chapterCount - 1));
}

export function passiveTransition({
  activeChapter,
  proofState,
  automationEnabled,
  reducedMotion,
  visible,
}) {
  if (!automationEnabled || reducedMotion || !visible) return null;
  if (activeChapter === 0) {
    return {
      delayMs: PROBLEM_AUTOMATION_DELAY_MS,
      action: { type: "select-chapter", chapter: 1 },
    };
  }
  if (activeChapter === 1 && proofState === "prelude") {
    return {
      delayMs: CONTINUITY_PRELUDE_DELAY_MS,
      action: { type: "enter-proof", play: true },
    };
  }
  return null;
}

export function mediaPolicy({ active, proofState, visible }) {
  const mediaActive = active && proofState === "media";
  return {
    preload: mediaActive ? "metadata" : "none",
    pause: !mediaActive || !visible,
    reset: !mediaActive,
  };
}

export function transitionReel(state, action, chapterCount = 4) {
  const interacted = action.userInitiated === true;
  const next = {
    ...state,
    automationEnabled: interacted ? false : state.automationEnabled,
  };
  if (action.type === "select-chapter") {
    next.activeChapter = boundedChapter(action.chapter, chapterCount);
    next.proofState = next.activeChapter === 0 ? "chapter" : "prelude";
    return next;
  }
  if (action.type === "enter-proof" && next.activeChapter > 0) {
    next.proofState = "media";
    return next;
  }
  if (action.type === "pause" || action.type === "media-interaction") {
    next.automationEnabled = false;
  }
  return next;
}
