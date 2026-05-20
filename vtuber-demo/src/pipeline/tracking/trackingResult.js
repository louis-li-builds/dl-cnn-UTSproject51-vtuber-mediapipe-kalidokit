/**
 * When the mirrored webcam shows the correct hand colours but the VRM uses the
 * opposite side, set to true (matches teammate skeleton default).
 */
export const TRACKING_SWAP_HAND_SIDES = false;

function oppositeSide(side) {
  return side === "left" ? "right" : "left";
}

function maybeSwapSide(side) {
  return TRACKING_SWAP_HAND_SIDES ? oppositeSide(side) : side;
}

function buildHandBlock(landmarks, worldLandmarks) {
  return {
    detected: landmarks.length > 0,
    landmarks,
    worldLandmarks,
    count: landmarks.length,
    worldCount: worldLandmarks.length,
  };
}

export function buildTrackingResult(rawResult, timestamp = performance.now()) {
  const faceLandmarks = rawResult.faceLandmarks?.[0] ?? [];
  const poseLandmarks = rawResult.poseLandmarks?.[0] ?? [];
  const poseWorldLandmarks = rawResult.poseWorldLandmarks?.[0] ?? [];

  let leftLm = rawResult.leftHandLandmarks?.[0] ?? [];
  let leftWorld = rawResult.leftHandWorldLandmarks?.[0] ?? [];
  let rightLm = rawResult.rightHandLandmarks?.[0] ?? [];
  let rightWorld = rawResult.rightHandWorldLandmarks?.[0] ?? [];

  if (TRACKING_SWAP_HAND_SIDES) {
    [leftLm, rightLm] = [rightLm, leftLm];
    [leftWorld, rightWorld] = [rightWorld, leftWorld];
  }

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
      left: buildHandBlock(leftLm, leftWorld),
      right: buildHandBlock(rightLm, rightWorld),
    },
  };
}
