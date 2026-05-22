import { buildTrackingResult } from "./trackingResult.js";
import { createDedicatedHandTracker } from "./handLandmarker.js";
import { resetHandLandmarkHold } from "./handLandmarkHold.js";
import { resetHandSlotStabilizer } from "./handSlotStabilizer.js";
import { resetSoloHandLatch } from "./soloHandLatch.js";

const TASKS_VISION_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/vision_bundle.mjs";

const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task";

function createOverlayCanvas(stage) {
  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.borderRadius = "10px";
  canvas.style.transform = "";

  stage.appendChild(canvas);
  return canvas;
}

function setOverlayMirrorStyle(canvas, mirrorInference) {
  canvas.style.transform = mirrorInference ? "" : "scaleX(-1)";
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

/** Draw video flipped horizontally so model input matches CSS-mirrored preview. */
function drawVideoHorizontallyFlipped(ctx, video, tw, th) {
  ctx.save();
  ctx.translate(tw, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, tw, th);
  ctx.restore();
}

function mergeTrackingOpts(trackingOptions, getTrackingOptions) {
  const base =
    typeof trackingOptions === "object" && trackingOptions ? trackingOptions : {};
  const fromFn =
    typeof getTrackingOptions === "function" ? getTrackingOptions() : {};
  return { ...base, ...fromFn };
}

/**
 * @param {object} options
 * @param {HTMLVideoElement} options.video
 * @param {HTMLElement} options.stage
 * @param {(s: string) => void} [options.onLog]
 * @param {(trackingResult: object) => void} [options.onFrame]
 * @param {number} [options.detectMaxWidth] if > 0, run Holistic on a downscaled canvas
 * @param {object} [options.trackingOptions] defaults for `buildTrackingResult` + mirror flags
 * @param {() => object} [options.getTrackingOptions] per-frame overrides (e.g. from demo-config)
 */
export async function initHolisticTracking({
  video,
  stage,
  onLog,
  onFrame,
  detectMaxWidth = 0,
  trackingOptions = {},
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
        modelAssetPath: MODEL_URL,
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: false,
    }
  );

  let dedicatedHandTracker = null;
  if (HandLandmarker) {
    try {
      dedicatedHandTracker = await createDedicatedHandTracker({
        filesetResolver,
        HandLandmarker,
      });
      onLog?.(
        "Dedicated HandLandmarker active (fused with Holistic for hands / gesture crop)."
      );
    } catch (error) {
      console.warn("[holistic] HandLandmarker disabled:", error);
      onLog?.(
        `HandLandmarker unavailable; using Holistic hands only. (${error?.message ?? error})`
      );
    }
  }

  const canvas = createOverlayCanvas(stage);
  const ctx = canvas.getContext("2d");

  const useDownscale =
    Number.isFinite(detectMaxWidth) && detectMaxWidth > 0;
  const detectCanvas = useDownscale ? document.createElement("canvas") : null;
  const detectCtx = useDownscale
    ? detectCanvas.getContext("2d", { willReadFrequently: true })
    : null;

  let flipFullCanvas = null;
  let flipFullCtx = null;

  let lastVideoTime = -1;
  let rafId = null;
  let lastHolisticLogMs = -Infinity;
  const HOLISTIC_LOG_INTERVAL_MS = 2500;

  function renderFrame() {
    if (video.readyState < 2) {
      rafId = requestAnimationFrame(renderFrame);
      return;
    }

    resizeCanvasToVideo(canvas, video, stage);

    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;

      const nowMs = performance.now();
      const opts = mergeTrackingOpts(trackingOptions, getTrackingOptions);
      const mirrorInference = opts.mirrorInference !== false;
      const buildOpts = {
        swapHandSides: Boolean(opts.swapHandSides),
        mirrorInference,
        invertMirroredHandedness: opts.invertMirroredHandedness !== false,
      };

      setOverlayMirrorStyle(canvas, mirrorInference);

      let detectSource = video;

      if (
        useDownscale &&
        detectCanvas &&
        detectCtx &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const maxW = Math.min(Math.floor(detectMaxWidth), vw);
        const tw = maxW;
        const th = Math.max(1, Math.round((tw * vh) / vw));
        if (detectCanvas.width !== tw || detectCanvas.height !== th) {
          detectCanvas.width = tw;
          detectCanvas.height = th;
        }
        if (mirrorInference) {
          drawVideoHorizontallyFlipped(detectCtx, video, tw, th);
        } else {
          detectCtx.drawImage(video, 0, 0, tw, th);
        }
        detectSource = detectCanvas;
      } else if (
        mirrorInference &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (
          !flipFullCanvas ||
          flipFullCanvas.width !== vw ||
          flipFullCanvas.height !== vh
        ) {
          flipFullCanvas = document.createElement("canvas");
          flipFullCanvas.width = vw;
          flipFullCanvas.height = vh;
          flipFullCtx = flipFullCanvas.getContext("2d", {
            willReadFrequently: true,
          });
        }
        drawVideoHorizontallyFlipped(flipFullCtx, video, vw, vh);
        detectSource = flipFullCanvas;
      }

      const rawResult = holisticLandmarker.detectForVideo(detectSource, nowMs);
      let handResult = null;
      if (dedicatedHandTracker) {
        try {
          handResult = dedicatedHandTracker.detect(detectSource, nowMs);
        } catch (error) {
          console.warn("[holistic] HandLandmarker detect failed:", error);
        }
      }
      const trackingResult = buildTrackingResult(
        { holisticResult: rawResult, handResult },
        nowMs,
        buildOpts
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

      if (onLog && nowMs - lastHolisticLogMs >= HOLISTIC_LOG_INTERVAL_MS) {
        lastHolisticLogMs = nowMs;
        const det =
          detectSource === video
            ? `${video.videoWidth}×${video.videoHeight}`
            : detectSource === flipFullCanvas
              ? `${flipFullCanvas.width}×${flipFullCanvas.height} (mirror full)`
              : `${detectCanvas.width}×${detectCanvas.height} (maxW=${detectMaxWidth})`;
        onLog(
          `active src=${det} mirror=${mirrorInference} face=${face.length} pose=${pose.length} L=${leftHand.length} R=${rightHand.length}`
        );
      }
    }

    rafId = requestAnimationFrame(renderFrame);
  }

  renderFrame();

  return {
    canvas,
    landmarker: holisticLandmarker,
    stop() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      if (typeof holisticLandmarker?.close === "function") {
        holisticLandmarker.close();
      }
      void dedicatedHandTracker?.close?.();
      dedicatedHandTracker = null;
      resetHandSlotStabilizer();
      resetHandLandmarkHold();
      resetSoloHandLatch();
    },
  };
}
