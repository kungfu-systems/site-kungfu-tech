// SPDX-License-Identifier: Apache-2.0

export const PROBLEM_AUTOMATION_DELAY_MS = 7000;
export const PROOF_PRELUDE_DELAY_MS = 5000;
export const PROOF_SCENE_TRANSITION_DURATION_MS = 480;
export const CONTINUITY_PRELUDE_DELAY_MS = PROOF_PRELUDE_DELAY_MS;

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
  if (activeChapter > 0 && proofState === "prelude") {
    return {
      delayMs: PROOF_PRELUDE_DELAY_MS,
      action: { type: "enter-proof", play: true },
    };
  }
  return null;
}

export function adjacentScene({ activeChapter, proofState }, direction, chapterCount = 4) {
  const count = Math.max(1, chapterCount);
  const chapter = boundedChapter(activeChapter, count);
  const lastChapter = count - 1;
  if (count === 1) return { activeChapter: 0, proofState: "chapter" };
  if (direction >= 0) {
    if (chapter === 0) return { activeChapter: 1, proofState: "prelude" };
    if (proofState !== "media") return { activeChapter: chapter, proofState: "media" };
    if (chapter === lastChapter) return { activeChapter: 0, proofState: "chapter" };
    return { activeChapter: chapter + 1, proofState: "prelude" };
  }
  if (chapter === 0) return { activeChapter: lastChapter, proofState: "media" };
  if (proofState === "media") return { activeChapter: chapter, proofState: "prelude" };
  if (chapter === 1) return { activeChapter: 0, proofState: "chapter" };
  return { activeChapter: chapter - 1, proofState: "media" };
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
  const next = { ...state };
  if (action.type === "select-chapter") {
    next.activeChapter = boundedChapter(action.chapter, chapterCount);
    next.proofState = next.activeChapter === 0 ? "chapter" : "prelude";
    return next;
  }
  if (action.type === "enter-proof" && next.activeChapter > 0) {
    next.proofState = "media";
    return next;
  }
  if (action.type === "play") {
    next.automationEnabled = true;
  }
  if (action.type === "pause" || action.type === "media-interaction") {
    next.automationEnabled = false;
  }
  return next;
}
