/**
 * Holistic + dedicated HandLandmarker fusion (teammate skeleton).
 * `swapHandSides` mirrors skeleton SWAP_OUTPUT_SIDES when true (default).
 */

const USE_MEDIAPIPE_HANDEDNESS = true;

function oppositeSide(side) {
  return side === "left" ? "right" : "left";
}

function maybeSwap(side, options = {}) {
  const swap = options.swapHandSides !== false;
  return swap ? oppositeSide(side) : side;
}

function buildHandBlock({
  landmarks = [],
  worldLandmarks = [],
  handednessScore = null,
  source = "none",
  handednessLabel = null,
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

function averageX(landmarks) {
  if (!landmarks || landmarks.length === 0) return 0.5;
  return landmarks.reduce((sum, lm) => sum + (lm.x ?? 0.5), 0) / landmarks.length;
}

function sideFromScreenPosition(landmarks, options) {
  const rawX = averageX(landmarks);
  return maybeSwap(rawX < 0.5 ? "right" : "left", options);
}

function sideFromHandedness(handednessLabel, options) {
  if (handednessLabel !== "left" && handednessLabel !== "right") {
    return null;
  }
  return maybeSwap(handednessLabel, options);
}

function extractDedicatedHands(handResult, options) {
  const output = {
    left: null,
    right: null,
  };

  if (!handResult || !Array.isArray(handResult.landmarks)) {
    return output;
  }

  for (let i = 0; i < handResult.landmarks.length; i += 1) {
    const landmarks = handResult.landmarks?.[i] ?? [];
    if (!landmarks || landmarks.length === 0) continue;

    const worldLandmarks = handResult.worldLandmarks?.[i] ?? [];

    const handedness = handResult.handedness?.[i]?.[0] ?? null;
    const handednessLabel = handedness?.categoryName?.toLowerCase?.() ?? null;
    const handednessScore = Number.isFinite(handedness?.score)
      ? handedness.score
      : 0;

    const side = USE_MEDIAPIPE_HANDEDNESS
      ? sideFromHandedness(handednessLabel, options)
      : sideFromScreenPosition(landmarks, options);

    if (side !== "left" && side !== "right") continue;

    const candidate = {
      landmarks,
      worldLandmarks,
      handednessScore,
      handednessLabel,
      source: USE_MEDIAPIPE_HANDEDNESS
        ? `handLandmarker:handedness:${handednessLabel ?? "unknown"}`
        : `handLandmarker:xpos:${handednessLabel ?? "unknown"}`,
    };

    const current = output[side];

    if (!current || handednessScore >= current.handednessScore) {
      output[side] = candidate;
    }
  }

  return output;
}

/**
 * @param {object} rawResult `{ holisticResult, handResult? }` or holistic-only result
 * @param {number} [timestamp]
 * @param {{ swapHandSides?: boolean }} [options]
 */
export function buildTrackingResult(
  rawResult,
  timestamp = performance.now(),
  options = {}
) {
  const holisticResult = rawResult?.holisticResult ?? rawResult ?? {};
  const handResult = rawResult?.handResult ?? null;

  const faceLandmarks = holisticResult.faceLandmarks?.[0] ?? [];
  const poseLandmarks = holisticResult.poseLandmarks?.[0] ?? [];
  const poseWorldLandmarks = holisticResult.poseWorldLandmarks?.[0] ?? [];

  const dedicated = extractDedicatedHands(handResult, options);

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

  const leftHand = dedicated.left ?? fallbackLeft;
  const rightHand = dedicated.right ?? fallbackRight;

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
      left: buildHandBlock(leftHand),
      right: buildHandBlock(rightHand),
    },
  };
}
