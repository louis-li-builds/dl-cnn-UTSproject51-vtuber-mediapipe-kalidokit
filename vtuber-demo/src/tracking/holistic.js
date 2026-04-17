import { buildTrackingResult } from "./trackingResult.js";

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

export async function initHolisticTracking({ video, stage, onLog, onFrame }) {
  if (!video) throw new Error("Video element is required.");
  if (!stage) throw new Error("Tracking stage is required.");

  const vision = await import(TASKS_VISION_URL);
  const { FilesetResolver, HolisticLandmarker } = vision;

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

  const canvas = createOverlayCanvas(stage);
  const ctx = canvas.getContext("2d");

  let lastVideoTime = -1;
  let rafId = null;

  function renderFrame() {
    if (video.readyState < 2) {
      rafId = requestAnimationFrame(renderFrame);
      return;
    }

    resizeCanvasToVideo(canvas, video, stage);

    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;

      const nowMs = performance.now();
      const rawResult = holisticLandmarker.detectForVideo(video, nowMs);
      const trackingResult = buildTrackingResult(rawResult, nowMs);

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
        onFrame(trackingResult);
      }

      if (onLog) {
        onLog(
          "Holistic tracking active.\n" +
            `Face landmarks: ${face.length}\n` +
            `Pose landmarks: ${pose.length}\n` +
            `Left hand landmarks: ${leftHand.length}\n` +
            `Right hand landmarks: ${rightHand.length}`
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
    },
  };
}