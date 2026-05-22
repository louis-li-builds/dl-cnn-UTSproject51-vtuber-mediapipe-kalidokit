/**
 * Holistic-only left/right slots. Optional final swap via options.swapHandSides.
 */

function buildHandBlock(landmarks, worldLandmarks, source = "holistic") {
  return {
    detected: landmarks.length > 0,
    landmarks,
    worldLandmarks,
    count: landmarks.length,
    worldCount: worldLandmarks.length,
    source,
  };
}

/**
 * @param {object} rawResult Holistic detectForVideo result
 * @param {number} [timestamp]
 * @param {{ swapHandSides?: boolean }} [options]
 */
export function buildTrackingResult(
  rawResult,
  timestamp = performance.now(),
  options = {}
) {
  const swap = Boolean(options.swapHandSides);

  const faceLandmarks = rawResult.faceLandmarks?.[0] ?? [];
  const poseLandmarks = rawResult.poseLandmarks?.[0] ?? [];
  const poseWorldLandmarks = rawResult.poseWorldLandmarks?.[0] ?? [];

  let leftLm = rawResult.leftHandLandmarks?.[0] ?? [];
  let leftWorld = rawResult.leftHandWorldLandmarks?.[0] ?? [];
  let rightLm = rawResult.rightHandLandmarks?.[0] ?? [];
  let rightWorld = rawResult.rightHandWorldLandmarks?.[0] ?? [];

  if (swap) {
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
