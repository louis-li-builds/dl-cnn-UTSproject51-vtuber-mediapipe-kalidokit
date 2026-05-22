/**
 * Freeze branch — minimal workflow:
 * webcam → VRM → log + motion UI → MediaPipe → (optional ONNX schedule) → export → VRM
 */
import { initWebcam, releaseAllWebcamTracks } from "./tracking/webcam.js";
import { initHolisticTracking } from "./tracking/holistic.js";
import { buildMotionState } from "./motion/motionState.js";
import { createMotionSmoother } from "./motion/smoother.js";
import { createSceneRuntime } from "./render/scene.js";
import { loadVrmModel } from "./avatar/vrmLoader.js";
import { mapMotionStateToAvatarState } from "./avatar/vrmMapper.js";
import { applyAvatarStateToVrm } from "./avatar/vrmDriver.js";
import { getAvatarEntry, getAvatarModelPath } from "./avatars.js";
import { logSystem, clearSystemLog } from "./systemLog.js";
import { patchRuntime } from "./runtimeStore.js";
import { createGestureClassifier } from "./gesture/gestureClassifier.js";
import { applyCnnGestureToMotionState } from "./gesture/applyCnnGesture.js";
import { createMocapForward } from "./forward/mocapForward.js";

const DEFAULT_CONFIG = {
  holistic: { detectMaxWidth: 640 },
  tracking: { swapHandSides: false },
  webcam: { videoProfile: "compact", objectFit: "contain", digitalZoom: 1 },
  gesture: { enabled: false },
  forward: { enabled: false, url: "ws://127.0.0.1:8765", intervalMs: 33 },
  smoothing: { mode: "lerp", alpha: 0.35 },
};

function mergeConfig(base, user) {
  if (!user || typeof user !== "object") return base;
  return {
    ...base,
    ...user,
    holistic: { ...base.holistic, ...user.holistic },
    tracking: { ...base.tracking, ...user.tracking },
    webcam: { ...base.webcam, ...user.webcam },
    gesture: { ...base.gesture, ...user.gesture },
    forward: { ...base.forward, ...user.forward },
    smoothing: { ...base.smoothing, ...user.smoothing },
  };
}

function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "null";
  }
  return Number(value).toFixed(digits);
}

function formatMotionPanel(trackingResult, motionState, extras = {}) {
  const snap = extras.gestureSnap;
  return `timestamp: ${Math.round(trackingResult.timestamp)}
gesture: ${snap?.enabled ? (snap.label ?? "—") : "off"} conf=${formatNumber(snap?.confidence)}
forward: ${extras.forwardOn ? "on" : "off"}

[tracking.hands]
L ${trackingResult.hands.left.detected ? "on" : "off"} n=${trackingResult.hands.left.count}
R ${trackingResult.hands.right.detected ? "on" : "off"} n=${trackingResult.hands.right.count}

[motion.face]
head_yaw: ${formatNumber(motionState.face?.head_yaw)}
mouth_open: ${formatNumber(motionState.face?.mouth_open)}

[motion.hands.left]
gesture_basic: ${motionState.hands?.left?.gesture_basic ?? "null"}
gesture_cnn: ${motionState.hands?.left?.gesture_cnn ?? "null"}

[motion.hands.right]
gesture_basic: ${motionState.hands?.right?.gesture_basic ?? "null"}
gesture_cnn: ${motionState.hands?.right?.gesture_cnn ?? "null"}`;
}

export async function bootVtuberPipeline({
  webcamMount,
  avatarMount,
  avatarId = "1",
}) {
  const appState = {
    webcam: null,
    sceneRuntime: null,
    trackingHandle: null,
    gestureClassifier: null,
    gestureConfig: null,
    demoConfig: DEFAULT_CONFIG,
    motionSmoother: null,
    mocapForward: null,
    destroyed: false,
  };

  let lastMotionUiMs = 0;
  const MOTION_UI_MS = 150;

  function setStatus(text) {
    patchRuntime({ status: text });
  }

  function renderTrackingResult(trackingResult) {
    if (appState.destroyed) return;

    try {
      const video = appState.webcam?.video ?? null;

      if (appState.gestureClassifier) {
        appState.gestureClassifier.schedule(video, trackingResult);
      }

      const rawMotion = buildMotionState(trackingResult, video);
      const motionState = appState.motionSmoother
        ? appState.motionSmoother.update(rawMotion)
        : rawMotion;

      if (appState.gestureConfig && appState.gestureClassifier) {
        applyCnnGestureToMotionState(
          motionState,
          appState.gestureClassifier.getSnapshot(),
          appState.gestureConfig
        );
      }

      const avatarState = mapMotionStateToAvatarState(motionState);
      const vrm = appState.sceneRuntime?.currentVrm;
      if (vrm) {
        applyAvatarStateToVrm(vrm, avatarState);
      }

      appState.mocapForward?.send(avatarState, trackingResult.timestamp);

      const now = performance.now();
      if (now - lastMotionUiMs >= MOTION_UI_MS) {
        lastMotionUiMs = now;
        const snap = appState.gestureClassifier?.getSnapshot?.();
        patchRuntime({
          motionText: formatMotionPanel(trackingResult, motionState, {
            gestureSnap: snap,
            forwardOn: Boolean(appState.mocapForward?.enabled),
          }),
        });
      }
    } catch (error) {
      console.error("[track] frame failed:", error);
    }
  }

  async function loadAvatar(modelPath, label = "") {
    const sceneRuntime = appState.sceneRuntime;
    if (!sceneRuntime) return;

    const tag = label ? `${label} ` : "";
    logSystem("vrm", `${tag}loading ${modelPath}`);

    try {
      const vrm = await loadVrmModel(modelPath);
      if (appState.destroyed || !vrm) return;
      sceneRuntime.setVrm(vrm);
      sceneRuntime.resize();
      logSystem("vrm", `${tag}loaded`);
    } catch (error) {
      console.error(error);
      logSystem("vrm", `${tag}FAILED — ${error.message}`);
    }
  }

  clearSystemLog();

  try {
    setStatus("Booting…");
    logSystem("boot", "Pipeline starting (freeze-6h)…");

    let demoCfg = DEFAULT_CONFIG;
    try {
      const res = await fetch("/demo-config.json");
      if (res.ok) {
        demoCfg = mergeConfig(DEFAULT_CONFIG, await res.json());
        logSystem("boot", "demo-config.json loaded");
      }
    } catch {
      logSystem("boot", "using built-in defaults");
    }
    appState.demoConfig = demoCfg;

    appState.motionSmoother = createMotionSmoother(demoCfg.smoothing ?? {});
    appState.mocapForward = createMocapForward(demoCfg.forward ?? {});

    logSystem("cam", "Opening webcam…");
    releaseAllWebcamTracks();
    const webcam = await initWebcam(webcamMount, {
      videoProfile: demoCfg.webcam?.videoProfile ?? "compact",
      objectFit: demoCfg.webcam?.objectFit ?? "contain",
      digitalZoom: demoCfg.webcam?.digitalZoom ?? 1,
      warmupMs: 300,
      maxAttempts: 4,
    });
    appState.webcam = webcam;
    logSystem(
      "cam",
      `Ready ${webcam.video.videoWidth}×${webcam.video.videoHeight}`
    );

    const sceneRuntime = createSceneRuntime(avatarMount);
    sceneRuntime.start();
    appState.sceneRuntime = sceneRuntime;

    await loadAvatar(
      getAvatarModelPath(avatarId),
      getAvatarEntry(avatarId).name
    );

    setStatus("Camera ready");

    if (demoCfg.gesture?.enabled) {
      logSystem("gesture", "Loading ONNX…");
      try {
        const gestureConfig = await fetch(
          "/assets/models/gesture/gesture-model.json"
        ).then((r) => r.json());
        appState.gestureConfig = {
          ...gestureConfig,
          modelUrl:
            gestureConfig.modelUrl?.replace(
              /hagrid_exp02_vgg\.onnx$/,
              "hagrid_exp02_vgg_inline.onnx"
            ) ?? "/assets/models/gesture/hagrid_exp02_vgg_inline.onnx",
        };
        const classifier = createGestureClassifier(appState.gestureConfig);
        await classifier.init();
        appState.gestureClassifier = classifier;
        const snap = classifier.getSnapshot();
        logSystem(
          "gesture",
          snap.enabled
            ? "CNN ready (non-blocking)"
            : `off — ${snap.disabledReason ?? "?"}`
        );
      } catch (e) {
        logSystem("gesture", `off — ${e?.message ?? e}`);
      }
    } else {
      logSystem("gesture", "disabled (set gesture.enabled in demo-config)");
    }

    logSystem("track", "Starting Holistic…");
    const trackingHandle = await initHolisticTracking({
      video: webcam.video,
      stage: webcam.stage,
      detectMaxWidth: demoCfg.holistic?.detectMaxWidth ?? 640,
      onFrame: renderTrackingResult,
      getTrackingOptions: () => ({
        swapHandSides: Boolean(demoCfg.tracking?.swapHandSides),
      }),
    });
    appState.trackingHandle = trackingHandle;

    setStatus("Running");
    logSystem("boot", "Running — move in front of the camera");
  } catch (error) {
    console.error(error);
    setStatus("Boot failed");
    logSystem("boot", `FAILED — ${error.name}: ${error.message}`);
  }

  return {
    async setAvatarId(nextId) {
      const entry = getAvatarEntry(nextId);
      await loadAvatar(entry.modelPath, entry.name);
    },

    destroy() {
      appState.destroyed = true;
      appState.trackingHandle?.stop?.();
      appState.sceneRuntime?.dispose?.();
      appState.webcam?.stop?.();
      releaseAllWebcamTracks();
      webcamMount.innerHTML = "";
      avatarMount.innerHTML = "";
    },
  };
}
