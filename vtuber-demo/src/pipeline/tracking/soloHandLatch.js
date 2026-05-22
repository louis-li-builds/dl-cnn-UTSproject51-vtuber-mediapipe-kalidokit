/**
 * After a single-hand dedicated detection, suppress Holistic fallback on the opposite
 * side for a short window — stops “ghost hand” flicker when dedicated drops one frame.
 */

const LATCH_MS = 450;

const state = {
  side: null,
  untilMs: 0,
};

export function resetSoloHandLatch() {
  state.side = null;
  state.untilMs = 0;
}

/**
 * @param {"left"|"right"|null} dedicatedSide which slot has dedicated landmarks this frame
 * @param {number} nowMs
 */
export function notifySoloDedicatedSide(dedicatedSide, nowMs) {
  if (dedicatedSide === "left" || dedicatedSide === "right") {
    state.side = dedicatedSide;
    state.untilMs = nowMs + LATCH_MS;
  } else if (nowMs > state.untilMs) {
    state.side = null;
  }
}

/**
 * @param {"left"|"right"} holisticFallbackSide side Holistic would fill if dedicated missing
 * @param {number} nowMs
 * @returns {boolean} true → use empty hand block instead of Holistic
 */
export function shouldSuppressHolisticFallback(holisticFallbackSide, nowMs) {
  if (!state.side || nowMs > state.untilMs) {
    return false;
  }
  const opposite = state.side === "left" ? "right" : "left";
  return holisticFallbackSide === opposite;
}
