/**
 * Dedicated HandLandmarker (runs beside Holistic) for sharper hands.
 * Uses the same official bucket pattern as holistic_landmarker.task.
 * Override with a local file if needed: baseOptions.modelAssetPath.
 */
const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

export async function createDedicatedHandTracker({
  filesetResolver,
  HandLandmarker,
}) {
  if (!filesetResolver || !HandLandmarker) {
    throw new Error("HandLandmarker dependencies are missing.");
  }

  try {
    const handLandmarker = await HandLandmarker.createFromOptions(
      filesetResolver,
      {
        baseOptions: {
          modelAssetPath: HAND_MODEL_URL,
        },
        runningMode: "VIDEO",
        numHands: 2,
        /** 略提高門檻，減少 handedness / id 在邊界來回切換 */
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.52,
        minTrackingConfidence: 0.56,
      }
    );

    return {
      detect(video, timestampMs) {
        return handLandmarker.detectForVideo(video, timestampMs);
      },

      async close() {
        if (typeof handLandmarker.close === "function") {
          await handLandmarker.close();
        }
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to create dedicated Hand Landmarker (${HAND_MODEL_URL}). ${error.message}`
    );
  }
}
