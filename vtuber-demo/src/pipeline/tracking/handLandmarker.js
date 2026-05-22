/**
 * Dedicated HandLandmarker (tasks-vision) for tighter 2D landmarks than Holistic hands.
 * Used together with Holistic in `holistic.js`; model is loaded from the official CDN.
 */
const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

/**
 * @param {{ filesetResolver: unknown; HandLandmarker: unknown }} deps
 */
export async function createDedicatedHandTracker({ filesetResolver, HandLandmarker }) {
  if (!filesetResolver || !HandLandmarker) {
    throw new Error("HandLandmarker dependencies are missing.");
  }

  const handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: HAND_MODEL_URL,
    },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  return {
    /**
     * @param {CanvasImageSource} video
     * @param {number} timestampMs
     */
    detect(video, timestampMs) {
      return handLandmarker.detectForVideo(video, timestampMs);
    },

    async close() {
      if (typeof handLandmarker.close === "function") {
        await handLandmarker.close();
      }
    },
  };
}
