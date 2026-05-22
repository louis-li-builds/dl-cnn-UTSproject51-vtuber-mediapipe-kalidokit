import { buildTrackingResult } from "./trackingResult.js";
import { createDedicatedHandTracker } from "./handLandmarker.js";

const TASKS_VISION_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/vision_bundle.mjs";

const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";

const HOLISTIC_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task";

/** Dedicated hand tracker ~10 Hz — same as teammate skeleton. */
const HAND_DETECT_INTERVAL_MS = 100;

function createOverlayCanvas(stage) {
  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.borderRadius = "10px";
  canvas.style.transform = "scaleX(-1)";
  stage.appendChild(canvas);
  return canvas;
}

function resizeCanvasToVideo(canvas, video, stage) {
  const rect = video.getBoundingClientRect();
  const displayWidth = Math.round(rect.width);
  const displayHeight = Math.round(rect.height);

  stage.style.width = `${displayWidth}px`;
  stage.style.height = `${displayHeight}px`;
  stage.style.margin = "0 auto";

  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
}

function drawPoints(ctx, landmarks, color, radius = 2) {
  if (!landmarks || landmarks.length === 0) return;

  ctx.fillStyle = color;

  for (const lm of landmarks) {
    const x = lm.x * ctx.canvas.width;
    const y = lm.y * ctx.canvas.height;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Teammate skeleton tracking + optional downscale for Holistic/Hand speed.
 * onFrame is always invoked synchronously (no frame drops while ONNX runs).
 */
export async function initHolisticTracking({
  video,
  stage,
  onFrame,
  detectMaxWidth = 640,
  getTrackingOptions,
}) {
  if (!video) throw new Error("Video element is required.");
  if (!stage) throw new Error("Tracking stage is required.");

  const vision = await import(/* @vite-ignore */ TASKS_VISION_URL);
  const { FilesetResolver, HolisticLandmarker, HandLandmarker } = vision;

  const filesetResolver = await FilesetResolver.forVisionTasks(WASM_ROOT);

  const holisticLandmarker = await HolisticLandmarker.createFromOptions(
    filesetResolver,
    {
      baseOptions: {
        modelAssetPath: HOLISTIC_MODEL_URL,
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: false,
    }
  );

  const dedicatedHandTracker = await createDedicatedHandTracker({
    filesetResolver,
    HandLandmarker,
  });

  const canvas = createOverlayCanvas(stage);
  const ctx = canvas.getContext("2d");

  const useDownscale =
    Number.isFinite(detectMaxWidth) && detectMaxWidth > 0;
  const detectCanvas = useDownscale ? document.createElement("canvas") : null;
  const detectCtx = useDownscale
    ? detectCanvas.getContext("2d", { willReadFrequently: true })
    : null;

  let lastVideoTime = -1;
  let rafId = null;
  let lastHandDetectMs = -Infinity;
  let lastHandResult = null;

  function getDetectSource() {
    if (
      !useDownscale ||
      !detectCanvas ||
      !detectCtx ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      return video;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const maxW = Math.min(Math.floor(detectMaxWidth), vw);
    const tw = maxW;
    const th = Math.max(1, Math.round((tw * vh) / vw));

    if (detectCanvas.width !== tw || detectCanvas.height !== th) {
      detectCanvas.width = tw;
      detectCanvas.height = th;
    }

    detectCtx.drawImage(video, 0, 0, tw, th);
    return detectCanvas;
  }

  function renderFrame() {
    if (video.readyState < 2) {
      rafId = requestAnimationFrame(renderFrame);
      return;
    }

    resizeCanvasToVideo(canvas, video, stage);

    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;

      const nowMs = performance.now();
      const detectSource = getDetectSource();

      const holisticResult = holisticLandmarker.detectForVideo(
        detectSource,
        nowMs
      );

      if (nowMs - lastHandDetectMs >= HAND_DETECT_INTERVAL_MS) {
        lastHandDetectMs = nowMs;
        lastHandResult = dedicatedHandTracker.detect(detectSource, nowMs);
      }

      const trackOpts =
        typeof getTrackingOptions === "function" ? getTrackingOptions() : {};

      const trackingResult = buildTrackingResult(
        { holisticResult, handResult: lastHandResult },
        nowMs,
        trackOpts
      );

      const face = trackingResult.face.landmarks;
      const pose = trackingResult.pose.landmarks;
      const leftHand = trackingResult.hands.left.landmarks;
      const rightHand = trackingResult.hands.right.landmarks;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawPoints(ctx, face, "#00FFFF", 1.2);
      drawPoints(ctx, pose, "#7CFC98", 4);
      drawPoints(ctx, leftHand, "#FFD700", 3);
      drawPoints(ctx, rightHand, "#FF69B4", 3);

      if (onFrame) {
        try {
          onFrame(trackingResult);
        } catch (error) {
          console.error("[holistic] onFrame failed:", error);
        }
      }
    }

    rafId = requestAnimationFrame(renderFrame);
  }

  renderFrame();

  return {
    canvas,
    holisticLandmarker,
    dedicatedHandTracker,
    stop() {
      if (rafId) cancelAnimationFrame(rafId);

      if (typeof dedicatedHandTracker?.close === "function") {
        dedicatedHandTracker.close();
      }

      if (typeof holisticLandmarker?.close === "function") {
        holisticLandmarker.close();
      }
    },
  };
}
