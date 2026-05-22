import { initWebcam } from "./tracking/webcam.js";
import { initHolisticTracking } from "./tracking/holistic.js";
import { buildMotionState } from "./motion/motionState.js";
import { createMotionSmoother } from "./motion/smoother.js";
import { createSceneRuntime } from "./render/scene.js";
import { loadVrmModel } from "./avatar/vrmLoader.js";
import { mapMotionStateToAvatarState } from "./avatar/vrmMapper.js";
import { applyAvatarStateToVrm } from "./avatar/vrmDriver.js";
import { createGestureClassifier } from "./gesture/gestureClassifier.js";
import { applyCnnGestureToMotionState } from "./gesture/applyCnnGesture.js";
import { createMocapForward } from "./forward/mocapForward.js";
import { AVATAR_CATALOG, getAvatarEntry, getAvatarModelPath } from "./avatars.js";
import { logSystem } from "./systemLog.js";
import { patchRuntime } from "./runtimeStore.js";

const DEFAULT_DEMO_CONFIG = {
  holistic: {
    detectMaxWidth: 640,
  },
  tracking: {
    /**
     * When true, MediaPipe "left" hand data is written to `trackingResult.hands.right`
     * (and vice versa). Use only if your **physical** left clearly drives the **wrong**
     * avatar arm after `mirrorInference`; default false keeps left→left, right→right.
     */
    swapHandSides: false,
    /**
     * When true (default), Holistic runs on a horizontally flipped frame so
     * labels match the CSS-mirrored webcam preview.
     */
    mirrorInference: true,
    /**
     * When true (default) together with `mirrorInference`, flip HandLandmarker
     * Left/Right labels before slotting **singleton** hands (fixes common webcam mirror
     * inversion). Set **false** if single-hand L/R is still wrong the other way.
     */
    invertMirroredHandedness: true,
  },
  webcam: {
    videoProfile: "standard",
    objectFit: "contain",
    digitalZoom: 1,
  },
  smoothing: {
    mode: "oneEuro",
    alpha: 0.3,
    oneEuro: {
      minCutoff: 0.8,
      beta: 0.012,
      dCutoff: 1.0,
    },
  },
  forward: {
    enabled: false,
    url: "ws://127.0.0.1:8765",
    intervalMs: 33,
    reconnectMs: 3000,
  },
  /** three.js framing — widen FOV / pull camera back so hands stay in view */
  scene: {
    cameraFov: 40,
    cameraDistance: 3.25,
    cameraHeight: 1.12,
    lookAtY: 1.02,
    avatarScale: 0.88,
  },
};

function mergeDemoConfig(base, user) {
  if (!user || typeof user !== "object") return base;
  return {
    ...base,
    ...user,
    holistic: { ...base.holistic, ...user.holistic },
    tracking: { ...base.tracking, ...user.tracking },
    webcam: { ...base.webcam, ...user.webcam },
    smoothing: {
      ...base.smoothing,
      ...user.smoothing,
      oneEuro: {
        ...base.smoothing.oneEuro,
        ...user.smoothing?.oneEuro,
      },
    },
    forward: { ...base.forward, ...user.forward },
    scene: { ...base.scene, ...(user.scene && typeof user.scene === "object" ? user.scene : {}) },
  };
}

function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "null";
  }
  return Number(value).toFixed(digits);
}

function formatMotionPanelText(trackingResult, motionState, extras) {
  const cfg = extras?.demoConfig ?? {};
  const snap = extras?.gestureSnap;

  return `timestamp: ${Math.round(trackingResult.timestamp)}
demo: holistic.maxW=${cfg.holistic?.detectMaxWidth ?? 0} swapSides=${Boolean(
    cfg.tracking?.swapHandSides
  )} invertH=${cfg.tracking?.invertMirroredHandedness !== false} (after wrist-match) mirrorInference=${
    cfg.tracking?.mirrorInference !== false
  } smoothing=${
    cfg.smoothing?.mode ?? "?"
  }
gesture: profile=${cfg.webcam?.videoProfile ?? "?"} snap=${snap ? "ok" : "off"}
forward: ${extras?.forwardOn ? cfg.forward?.url : "off"}

[tracking.face]
detected: ${trackingResult.face.detected}
count: ${trackingResult.face.count}

[tracking.pose]
detected: ${trackingResult.pose.detected}
count: ${trackingResult.pose.count}

[tracking.hands.left]
detected: ${trackingResult.hands.left.detected}
count: ${trackingResult.hands.left.count}
worldCount: ${trackingResult.hands.left.worldCount ?? 0}
source: ${trackingResult.hands.left.source ?? "?"}

[tracking.hands.right]
detected: ${trackingResult.hands.right.detected}
count: ${trackingResult.hands.right.count}
worldCount: ${trackingResult.hands.right.worldCount ?? 0}
source: ${trackingResult.hands.right.source ?? "?"}

[motion.face]
head_yaw: ${formatNumber(motionState.face?.head_yaw)}
head_pitch: ${formatNumber(motionState.face?.head_pitch)}
head_roll: ${formatNumber(motionState.face?.head_roll)}
blink_left: ${formatNumber(motionState.face?.blink_left)}
blink_right: ${formatNumber(motionState.face?.blink_right)}
eye_open_left: ${formatNumber(motionState.face?.eye_open_left)}
eye_open_right: ${formatNumber(motionState.face?.eye_open_right)}
mouth_open: ${formatNumber(motionState.face?.mouth_open)}

[motion.upper_body]
left_elbow_angle: ${formatNumber(motionState.upper_body?.left_elbow_angle, 2)}
right_elbow_angle: ${formatNumber(motionState.upper_body?.right_elbow_angle, 2)}

[motion.hands.left]
wrist_angle: ${formatNumber(motionState.hands?.left?.wrist_angle, 2)}
gesture_basic: ${motionState.hands?.left?.gesture_basic ?? "null"}
gesture_cnn: ${motionState.hands?.left?.gesture_cnn ?? "null"}
gesture_cnn_active: ${motionState.hands?.left?.gesture_cnn_active ?? "null"}
gesture_cnn_conf: ${formatNumber(motionState.hands?.left?.gesture_cnn_confidence)}
palm_open: ${formatNumber(motionState.hands?.left?.palm_open)}
pinch_distance: ${formatNumber(motionState.hands?.left?.pinch_distance)}

[motion.hands.right]
wrist_angle: ${formatNumber(motionState.hands?.right?.wrist_angle, 2)}
gesture_basic: ${motionState.hands?.right?.gesture_basic ?? "null"}
gesture_cnn: ${motionState.hands?.right?.gesture_cnn ?? "null"}
gesture_cnn_active: ${motionState.hands?.right?.gesture_cnn_active ?? "null"}
gesture_cnn_conf: ${formatNumber(motionState.hands?.right?.gesture_cnn_confidence)}
palm_open: ${formatNumber(motionState.hands?.right?.palm_open)}
pinch_distance: ${formatNumber(motionState.hands?.right?.pinch_distance)}`;
}

/**
 * Figma / Vite UI shell + course pipeline (Holistic, Kalidokit, gesture ONNX, VRM).
 * @param {{ webcamMount: HTMLElement, avatarMount: HTMLElement, avatarId?: string }} options
 */
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
    demoConfig: DEFAULT_DEMO_CONFIG,
    motionSmoother: null,
    mocapForward: null,
    destroyed: false,
  };

  /** modelPath → Promise<VRM> — avoids blank frame when switching avatars */
  const vrmCache = new Map();

  /** Avoid re-rendering the large motion `<pre>` at camera frame rate. */
  let lastMotionUiMs = 0;
  const MOTION_UI_MIN_MS = 120;

  let lastTrackLogMs = 0;
  const TRACK_LOG_MIN_MS = 1500;

  function setStatus(text) {
    patchRuntime({ status: text });
  }

  function maybeLogTracking(trackingResult) {
    const now = performance.now();
    if (now - lastTrackLogMs < TRACK_LOG_MIN_MS) return;
    lastTrackLogMs = now;

    const L = trackingResult.hands.left;
    const R = trackingResult.hands.right;
    const shortSrc = (s) => (s ?? "?").split("+")[0];

    logSystem(
      "track",
      `L ${L.detected ? "on" : "off"} n=${L.count} src=${shortSrc(L.source)} | ` +
        `R ${R.detected ? "on" : "off"} n=${R.count} src=${shortSrc(R.source)}`
    );
  }

  function renderTrackingResult(trackingResult) {
    if (appState.destroyed) return;

    try {
      const video = appState.webcam?.video ?? null;

      appState.gestureClassifier?.schedule(video, trackingResult);

      const rawMotionState = buildMotionState(trackingResult, video);
      const motionState = appState.motionSmoother
        ? appState.motionSmoother.update(rawMotionState)
        : rawMotionState;

      applyCnnGestureToMotionState(
        motionState,
        appState.gestureClassifier?.getSnapshot(),
        appState.gestureConfig
      );

      const avatarState = mapMotionStateToAvatarState(motionState);
      const currentVrm = appState.sceneRuntime?.currentVrm ?? null;

      if (currentVrm) {
        applyAvatarStateToVrm(currentVrm, avatarState);
      }

      appState.mocapForward?.send(avatarState, trackingResult.timestamp);

      maybeLogTracking(trackingResult);

      const now = performance.now();
      if (now - lastMotionUiMs >= MOTION_UI_MIN_MS) {
        lastMotionUiMs = now;
        const snap = appState.gestureClassifier?.getSnapshot();
        patchRuntime({
          motionText: formatMotionPanelText(trackingResult, motionState, {
            demoConfig: appState.demoConfig,
            gestureSnap: snap,
            forwardOn: Boolean(appState.mocapForward?.enabled),
          }),
        });
      }
    } catch (error) {
      console.error("[track] frame handler failed:", error);
    }
  }

  function loadVrmCached(modelPath) {
    if (!vrmCache.has(modelPath)) {
      vrmCache.set(
        modelPath,
        loadVrmModel(modelPath).catch((error) => {
          vrmCache.delete(modelPath);
          throw error;
        })
      );
    }
    return vrmCache.get(modelPath);
  }

  async function disposeVrmCache() {
    const entries = [...vrmCache.entries()];
    vrmCache.clear();
    for (const [, promise] of entries) {
      try {
        const vrm = await promise;
        if (vrm && typeof vrm.dispose === "function") {
          vrm.dispose();
        }
      } catch {
        /* ignore load failures */
      }
    }
  }

  async function loadAvatar(modelPath, label = "") {
    const sceneRuntime = appState.sceneRuntime;
    if (!sceneRuntime) return;

    const tag = label ? `${label} ` : "";
    const cached = vrmCache.has(modelPath);
    logSystem("vrm", `${tag}${cached ? "cache hit" : "loading"} ${modelPath}`);
    const t0 = performance.now();

    try {
      const vrm = await loadVrmCached(modelPath);
      if (!vrm || appState.destroyed) {
        return;
      }
      sceneRuntime.setVrm(vrm);
      sceneRuntime.resize();
      requestAnimationFrame(() => {
        sceneRuntime.resize();
        requestAnimationFrame(() => sceneRuntime.resize());
      });
      logSystem(
        "vrm",
        `${tag}loaded OK (${Math.round(performance.now() - t0)} ms) — ${modelPath}`
      );
    } catch (error) {
      console.error(error);
      logSystem("vrm", `${tag}FAILED — ${error.message}`);
    }
  }

  try {
    setStatus("Booting…");
    logSystem("boot", "Pipeline starting…");
    logSystem("boot", `${AVATAR_CATALOG.length} avatars in catalog`);

    let demoCfg = DEFAULT_DEMO_CONFIG;
    try {
      const res = await fetch("/demo-config.json");
      if (res.ok) {
        const userCfg = await res.json();
        demoCfg = mergeDemoConfig(DEFAULT_DEMO_CONFIG, userCfg);
        logSystem("boot", "demo-config.json loaded");
      } else {
        logSystem("boot", "demo-config.json missing — using built-in defaults");
      }
    } catch {
      logSystem("boot", "demo-config fetch failed — using built-in defaults");
    }
    appState.demoConfig = demoCfg;
    logSystem(
      "boot",
      `holistic maxW=${demoCfg.holistic?.detectMaxWidth ?? 0} | ` +
        `swapSides=${Boolean(demoCfg.tracking?.swapHandSides)} | ` +
        `mirror=${demoCfg.tracking?.mirrorInference !== false} | ` +
        `invertH=${demoCfg.tracking?.invertMirroredHandedness !== false}`
    );
    appState.motionSmoother = createMotionSmoother(demoCfg.smoothing ?? {});
    appState.mocapForward = createMocapForward(demoCfg.forward ?? {});

    logSystem("cam", "Requesting getUserMedia…");
    const webcam = await initWebcam(webcamMount, {
      videoProfile: demoCfg.webcam?.videoProfile ?? "standard",
      objectFit: demoCfg.webcam?.objectFit ?? "contain",
      digitalZoom: demoCfg.webcam?.digitalZoom ?? 1,
    });
    appState.webcam = webcam;
    logSystem(
      "cam",
      `Ready ${webcam.video.videoWidth}×${webcam.video.videoHeight} profile=${demoCfg.webcam?.videoProfile ?? "standard"}`
    );

    const sceneRuntime = createSceneRuntime(avatarMount, demoCfg.scene ?? {});
    sceneRuntime.start();
    appState.sceneRuntime = sceneRuntime;
    requestAnimationFrame(() => {
      sceneRuntime.resize();
      requestAnimationFrame(() => sceneRuntime.resize());
    });

    const initialEntry = getAvatarEntry(avatarId);
    await loadAvatar(initialEntry.modelPath, `id=${avatarId} ${initialEntry.name}`);

    setStatus("Camera ready");
    logSystem("scene", `Three.js ready | smoothing=${demoCfg.smoothing?.mode ?? "oneEuro"}`);

    logSystem("gesture", "Loading gesture-model.json + ONNX…");
    try {
      const gestureConfig = await fetch(
        "/assets/models/gesture/gesture-model.json"
      ).then((r) => r.json());
      appState.gestureConfig = gestureConfig;
      const gestureClassifier = createGestureClassifier(gestureConfig);
      await gestureClassifier.init();
      appState.gestureClassifier = gestureClassifier;
      const snap = gestureClassifier.getSnapshot();
      logSystem(
        "gesture",
        snap.enabled
          ? `CNN ready (interval ${gestureConfig.inferenceIntervalMs ?? "?"} ms)`
          : `CNN disabled — ${snap.disabledReason ?? "unknown"}`
      );
    } catch (gestureError) {
      console.warn(gestureError);
      logSystem(
        "gesture",
        `CNN disabled — ${gestureError?.message ?? String(gestureError)}`
      );
    }

    logSystem("track", "Starting Holistic + HandLandmarker…");
    const trackingHandle = await initHolisticTracking({
      video: webcam.video,
      stage: webcam.stage,
      onLog: (msg) => {
        const oneLine = msg.replace(/\s+/g, " ").trim();
        if (oneLine) logSystem("holistic", oneLine.slice(0, 200));
      },
      onFrame: renderTrackingResult,
      detectMaxWidth: demoCfg.holistic?.detectMaxWidth ?? 0,
      trackingOptions: {},
      getTrackingOptions: () => ({
        swapHandSides: Boolean(appState.demoConfig.tracking?.swapHandSides),
        mirrorInference: appState.demoConfig.tracking?.mirrorInference !== false,
        invertMirroredHandedness:
          appState.demoConfig.tracking?.invertMirroredHandedness !== false,
      }),
    });
    appState.trackingHandle = trackingHandle;

    setStatus("Running");
    logSystem("boot", "Running — track lines update ~1.5 s (see [track])");
  } catch (error) {
    console.error(error);
    setStatus("Boot failed");
    logSystem("boot", `FAILED — ${error.name}: ${error.message}`);
  }

  return {
    async setAvatarId(nextId) {
      const entry = getAvatarEntry(nextId);
      logSystem("vrm", `User selected id=${nextId} (${entry.name})`);
      await loadAvatar(entry.modelPath, `switch ${entry.name}`);
    },

    destroy() {
      appState.destroyed = true;
      appState.trackingHandle?.stop?.();
      appState.sceneRuntime?.dispose?.();
      void disposeVrmCache();
      if (appState.webcam?.stream) {
        appState.webcam.stream.getTracks().forEach((t) => t.stop());
      }
      webcamMount.innerHTML = "";
      avatarMount.innerHTML = "";
    },
  };
}
