/**
 * Holistic-only callers can still pass the raw `detectForVideo` object as the first argument.
 * When `handResult` is present, dedicated HandLandmarker landmarks override Holistic per slot.
 *
 * **Left/right:** Dual Holistic hands → wrist-distance match. Single Holistic channel (singleton)
 * → mirrored handedness + **slot stabilizer** (reduces flicker). `swapHandSides` swaps final slots.
 */

import {
  applyHandLandmarkHold,
  emptyPick,
  resetHandLandmarkHold,
} from "./handLandmarkHold.js";
import {
  notifySoloDedicatedSide,
  resetSoloHandLatch,
  shouldSuppressHolisticFallback,
} from "./soloHandLatch.js";
import {
  notifyHandTrackingTopology,
  stabilizeSingletonHandSlot,
} from "./handSlotStabilizer.js";

const USE_MEDIAPIPE_HANDEDNESS = true;

function oppositeSide(side) {
  return side === "left" ? "right" : "left";
}

function buildHandBlock({
  landmarks = [],
  worldLandmarks = [],
  handednessScore = null,
  handednessLabel = null,
  source = "none",
}) {
  return {
    detected: landmarks.length > 0,
    landmarks,
    worldLandmarks,
    count: landmarks.length,
    worldCount: worldLandmarks.length,
    handednessScore,
    handednessLabel,
    source,
  };
}

function wristPoint(landmarks) {
  const w = landmarks?.[0];
  return { x: w?.x ?? 0.5, y: w?.y ?? 0.5, z: w?.z ?? 0 };
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function averageX(landmarks) {
  if (!landmarks || landmarks.length === 0) return 0.5;
  return landmarks.reduce((sum, lm) => sum + (lm.x ?? 0.5), 0) / landmarks.length;
}

function sideFromScreenPosition(landmarks) {
  const rawX = averageX(landmarks);
  return rawX < 0.5 ? "right" : "left";
}

function sideFromHandednessLabel(handednessLabel) {
  if (handednessLabel !== "left" && handednessLabel !== "right") {
    return null;
  }
  return handednessLabel;
}

/**
 * @param {boolean} [applyInvert] When false, do not flip labels (used for 2-hand handedness-only pairing).
 */
function slotFromMirroredHandedness(handednessLabel, options, applyInvert = true) {
  const base = sideFromHandednessLabel(handednessLabel);
  if (base === null) return null;
  const mirror = options?.mirrorInference !== false;
  const invert = applyInvert && options?.invertMirroredHandedness !== false;
  if (mirror && invert) {
    return oppositeSide(base);
  }
  return base;
}

function buildDedicatedCandidate(h, sourceTag) {
  const { landmarks, worldLandmarks, handednessScore, handednessLabel } = h;
  return {
    landmarks,
    worldLandmarks,
    handednessScore,
    handednessLabel,
    source: sourceTag,
  };
}

function extractHandList(handResult) {
  const list = [];
  if (!handResult || !Array.isArray(handResult.landmarks)) {
    return list;
  }

  for (let i = 0; i < handResult.landmarks.length; i += 1) {
    const landmarks = handResult.landmarks?.[i] ?? [];
    if (!landmarks.length) continue;

    const worldLandmarks = handResult.worldLandmarks?.[i] ?? [];
    const handedness = handResult.handedness?.[i]?.[0] ?? null;
    const handednessLabel = handedness?.categoryName?.toLowerCase?.() ?? null;
    const handednessScore = Number.isFinite(handedness?.score) ? handedness.score : 0;

    list.push({
      landmarks,
      worldLandmarks,
      handednessScore,
      handednessLabel,
    });
  }

  return list;
}

/**
 * Handedness-only assignment (no Holistic anchors). `swapHandSides` applied later by caller.
 */
function assignDedicatedByHandednessOnly(hands, options) {
  if (hands.length === 1) {
    const h = hands[0];
    let proposed;
    if (USE_MEDIAPIPE_HANDEDNESS) {
      proposed = slotFromMirroredHandedness(h.handednessLabel, options, true);
    } else {
      proposed = sideFromScreenPosition(h.landmarks);
    }

    if (proposed !== "left" && proposed !== "right") {
      return { left: null, right: null };
    }

    const side = stabilizeSingletonHandSlot(proposed);
    const tag = USE_MEDIAPIPE_HANDEDNESS
      ? `handLandmarker:1h_handedness:${h.handednessLabel ?? "?"}→${side}`
      : `handLandmarker:1h_xpos→${side}`;

    if (side === "left") {
      return { left: buildDedicatedCandidate(h, tag), right: null };
    }
    return { left: null, right: buildDedicatedCandidate(h, tag) };
  }

  const output = { left: null, right: null };

  for (const h of hands) {
    const side = USE_MEDIAPIPE_HANDEDNESS
      ? slotFromMirroredHandedness(h.handednessLabel, options, false)
      : sideFromScreenPosition(h.landmarks);

    if (side !== "left" && side !== "right") continue;

    const candidate = buildDedicatedCandidate(
      h,
      USE_MEDIAPIPE_HANDEDNESS
        ? `handLandmarker:handedness:${h.handednessLabel ?? "unknown"}`
        : `handLandmarker:xpos:${h.handednessLabel ?? "unknown"}`
    );

    const current = output[side];
    if (!current || h.handednessScore >= (current.handednessScore ?? 0)) {
      output[side] = candidate;
    }
  }

  return output;
}

function assignDedicatedWithHolisticAnchors(handsIn, holisticResult, options) {
  const hands = handsIn.slice(0, 2);
  const hLeftLm = holisticResult.leftHandLandmarks?.[0];
  const hRightLm = holisticResult.rightHandLandmarks?.[0];
  const hasL = hLeftLm?.length > 0;
  const hasR = hRightLm?.length > 0;

  if (!hasL && !hasR) {
    return assignDedicatedByHandednessOnly(hands, options);
  }

  const wL = hasL ? wristPoint(hLeftLm) : null;
  const wR = hasR ? wristPoint(hRightLm) : null;

  let left = null;
  let right = null;

  if (hands.length === 1) {
    const h = hands[0];
    const w0 = wristPoint(h.landmarks);

    if (hasL && hasR) {
      const proposed = dist2(w0, wL) <= dist2(w0, wR) ? "left" : "right";
      const side = stabilizeSingletonHandSlot(proposed);
      const tag = `handLandmarker:wrist→holistic_${side}`;
      if (side === "left") {
        left = buildDedicatedCandidate(h, tag);
      } else {
        right = buildDedicatedCandidate(h, tag);
      }
    } else if (hasL !== hasR) {
      const holisticSole = hasL ? "left" : "right";
      let proposed;
      if (USE_MEDIAPIPE_HANDEDNESS) {
        proposed = slotFromMirroredHandedness(h.handednessLabel, options, true);
      } else {
        proposed = sideFromScreenPosition(h.landmarks);
      }
      if (proposed !== "left" && proposed !== "right") {
        proposed = holisticSole;
      }
      const side = stabilizeSingletonHandSlot(proposed);
      const tag = `handLandmarker:singleton→${side}(h=${h.handednessLabel ?? "?"},hol=${holisticSole})`;
      if (side === "left") {
        left = buildDedicatedCandidate(h, tag);
      } else {
        right = buildDedicatedCandidate(h, tag);
      }
    }
  } else if (hands.length >= 2) {
    const h0 = hands[0];
    const h1 = hands[1];
    const w0 = wristPoint(h0.landmarks);
    const w1 = wristPoint(h1.landmarks);

    if (hasL && hasR) {
      const s01 = dist2(w0, wL) + dist2(w1, wR);
      const s10 = dist2(w0, wR) + dist2(w1, wL);
      if (s01 <= s10) {
        left = buildDedicatedCandidate(h0, "handLandmarker:2h_match(L0,R1)");
        right = buildDedicatedCandidate(h1, "handLandmarker:2h_match(L0,R1)");
      } else {
        left = buildDedicatedCandidate(h1, "handLandmarker:2h_match(L1,R0)");
        right = buildDedicatedCandidate(h0, "handLandmarker:2h_match(L1,R0)");
      }
    } else {
      return assignDedicatedByHandednessOnly(hands, options);
    }
  }

  return { left, right };
}

function mergeDedicatedSlots(dedicated, swapHandSides) {
  let { left, right } = dedicated;
  if (swapHandSides) {
    const t = left;
    left = right;
    right = t;
  }
  return { left, right };
}

/**
 * @param {object} input Holistic raw result, or `{ holisticResult, handResult }`.
 * @param {number} [timestamp]
 * @param {{
 *   swapHandSides?: boolean;
 *   mirrorInference?: boolean;
 *   invertMirroredHandedness?: boolean;
 * }} [options]
 */
export function buildTrackingResult(input, timestamp = performance.now(), options = {}) {
  const swapHandSides = Boolean(options.swapHandSides);

  const hasFusionShape =
    input &&
    (Object.prototype.hasOwnProperty.call(input, "holisticResult") ||
      Object.prototype.hasOwnProperty.call(input, "handResult"));

  const holisticResult = hasFusionShape ? input.holisticResult ?? {} : input ?? {};
  const handResult = hasFusionShape ? input.handResult ?? null : null;

  const faceLandmarks = holisticResult.faceLandmarks?.[0] ?? [];
  const poseLandmarks = holisticResult.poseLandmarks?.[0] ?? [];
  const poseWorldLandmarks = holisticResult.poseWorldLandmarks?.[0] ?? [];

  const handList = extractHandList(handResult);

  const hLeftLm = holisticResult.leftHandLandmarks?.[0];
  const hRightLm = holisticResult.rightHandLandmarks?.[0];
  const hasL = hLeftLm?.length > 0;
  const hasR = hRightLm?.length > 0;

  notifyHandTrackingTopology(handList.length);

  const rawDedicated =
    handList.length === 0
      ? { left: null, right: null }
      : assignDedicatedWithHolisticAnchors(handList, holisticResult, options);

  const dedicated = mergeDedicatedSlots(rawDedicated, swapHandSides);

  const fallbackLeft = {
    landmarks: holisticResult.leftHandLandmarks?.[0] ?? [],
    worldLandmarks: holisticResult.leftHandWorldLandmarks?.[0] ?? [],
    handednessScore: null,
    handednessLabel: "left",
    source: "holistic",
  };

  const fallbackRight = {
    landmarks: holisticResult.rightHandLandmarks?.[0] ?? [],
    worldLandmarks: holisticResult.rightHandWorldLandmarks?.[0] ?? [],
    handednessScore: null,
    handednessLabel: "right",
    source: "holistic",
  };

  const nowMs = timestamp;

  if (dedicated.left && dedicated.right) {
    notifySoloDedicatedSide(null, nowMs);
  } else if (dedicated.left) {
    notifySoloDedicatedSide("left", nowMs);
  } else if (dedicated.right) {
    notifySoloDedicatedSide("right", nowMs);
  } else {
    notifySoloDedicatedSide(null, nowMs);
  }

  let pickLeft = dedicated.left ?? fallbackLeft;
  let pickRight = dedicated.right ?? fallbackRight;

  if (!dedicated.left && shouldSuppressHolisticFallback("left", nowMs)) {
    pickLeft = emptyPick();
  }
  if (!dedicated.right && shouldSuppressHolisticFallback("right", nowMs)) {
    pickRight = emptyPick();
  }

  /** One dedicated slot filled: suppress Holistic ghost hand on the empty side (major flicker source). */
  const onlyLeftDedicated = Boolean(dedicated.left) && !dedicated.right;
  const onlyRightDedicated = Boolean(dedicated.right) && !dedicated.left;
  if (onlyLeftDedicated) {
    pickRight = emptyPick();
  } else if (onlyRightDedicated) {
    pickLeft = emptyPick();
  }

  const held = applyHandLandmarkHold(pickLeft, pickRight, timestamp);
  pickLeft = held.left;
  pickRight = held.right;

  return {
    timestamp,

    face: {
      detected: faceLandmarks.length > 0,
      landmarks: faceLandmarks,
      count: faceLandmarks.length,
    },

    pose: {
      detected: poseLandmarks.length > 0,
      landmarks: poseLandmarks,
      worldLandmarks: poseWorldLandmarks,
      count: poseLandmarks.length,
      worldCount: poseWorldLandmarks.length,
    },

    hands: {
      left: buildHandBlock(pickLeft),
      right: buildHandBlock(pickRight),
    },
  };
}

/** @deprecated Use `options.swapHandSides` in `buildTrackingResult`; kept for grep/docs. */
export const TRACKING_SWAP_HAND_SIDES = false;
