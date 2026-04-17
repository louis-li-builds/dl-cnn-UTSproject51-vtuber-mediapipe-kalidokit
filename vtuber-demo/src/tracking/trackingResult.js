export function buildTrackingResult(rawResult, timestamp = performance.now()) {
  const faceLandmarks = rawResult.faceLandmarks?.[0] ?? [];
  const poseLandmarks = rawResult.poseLandmarks?.[0] ?? [];
  const poseWorldLandmarks = rawResult.poseWorldLandmarks?.[0] ?? [];
  const leftHandLandmarks = rawResult.leftHandLandmarks?.[0] ?? [];
  const rightHandLandmarks = rawResult.rightHandLandmarks?.[0] ?? [];

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
      left: {
        detected: leftHandLandmarks.length > 0,
        landmarks: leftHandLandmarks,
        count: leftHandLandmarks.length,
      },
      right: {
        detected: rightHandLandmarks.length > 0,
        landmarks: rightHandLandmarks,
        count: rightHandLandmarks.length,
      },
    },
  };
}