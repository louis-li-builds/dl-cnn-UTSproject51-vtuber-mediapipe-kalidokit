/**
 * Prevents rapid L/R slot flips when only one hand is tracked (Holistic XOR channels +
 * handedness noise), which caused visible flicker on overlay / avatar.
 */

/** Consecutive frames before a singleton slot change commits (higher = less flicker). */
const STREAK_TO_COMMIT = 5;

const state = {
  pending: null,
  streak: 0,
  committed: null,
};

export function resetHandSlotStabilizer() {
  state.pending = null;
  state.streak = 0;
  state.committed = null;
}

/**
 * Call each frame before assigning a singleton dedicated hand to left/right.
 * @param {"left"|"right"} proposed
 * @returns {"left"|"right"}
 */
export function stabilizeSingletonHandSlot(proposed) {
  if (proposed !== "left" && proposed !== "right") {
    return proposed;
  }

  if (proposed === state.pending) {
    state.streak += 1;
  } else {
    state.pending = proposed;
    state.streak = 1;
  }

  if (state.committed === null || state.streak >= STREAK_TO_COMMIT) {
    state.committed = state.pending;
  }

  return state.committed;
}

/**
 * Reset stabilizer only when both dedicated hands are present or none.
 * Do NOT reset for "1 dedicated + 2 holistic wrists" — that pattern flickers every frame
 * and was clearing committed slot state (visible overlay / avatar flash).
 * @param {number} dedicatedHandCount hands from HandLandmarker (0–2)
 */
export function notifyHandTrackingTopology(dedicatedHandCount) {
  if (dedicatedHandCount >= 2 || dedicatedHandCount === 0) {
    resetHandSlotStabilizer();
  }
}
