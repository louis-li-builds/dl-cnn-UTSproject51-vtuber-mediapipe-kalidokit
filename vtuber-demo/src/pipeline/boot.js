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
import { getAvatarModelPath } from "./avatars.js";
import { patchRuntime } from "./runtimeStore.js";

const DEFAULT_DEMO_CONFIG = {
  holistic: {
    detectMaxWidth: 640,
  },
  tracking: {
    /** Swap MediaPipe L/R channels (avatar rig vs camera). */
    swapHandSides: false,
    /**
     * When true (default), Holistic runs on a horizontally flipped frame so
     * labels match the CSS-mirrored webcam preview.
     */
    mirrorInference: true,
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
      minCutoff: 1.0,
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
  )} mirrorInference=${cfg.tracking?.mirrorInference !== false} smoothing=${
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

[tracking.hands.right]
detected: ${trackingResult.hands.right.detected}
count: ${trackingResult.hands.right.count}
worldCount: ${trackingResult.hands.right.worldCount ?? 0}

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

  function setStatus(text) {
    patchRuntime({ status: text });
  }

  function setLog(text) {
    patchRuntime({ logText: text });
  }

  function renderTrackingResult(trackingResult) {
    if (appState.destroyed) return;

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

    const snap = appState.gestureClassifier?.getSnapshot();
    patchRuntime({
      motionText: formatMotionPanelText(trackingResult, motionState, {
        demoConfig: appState.demoConfig,
        gestureSnap: snap,
        forwardOn: Boolean(appState.mocapForward?.enabled),
      }),
    });
  }

  async function loadAvatar(modelPath) {
    const sceneRuntime = appState.sceneRuntime;
    if (!sceneRuntime) return;

    try {
      const vrm = await loadVrmModel(modelPath);
      if (appState.destroyed) {
        return;
      }
      sceneRuntime.setVrm(vrm);
      sceneRuntime.resize();
      setLog(`VRM loaded: ${modelPath}`);
    } catch (error) {
      console.error(error);
      setLog(`VRM load failed: ${error.message}`);
    }
  }

  try {
    setStatus("Booting…");
    setLog("Loading pipeline…\nRequesting camera…");

    let demoCfg = DEFAULT_DEMO_CONFIG;
    try {
      const res = await fetch("/demo-config.json");
      if (res.ok) {
        const userCfg = await res.json();
        demoCfg = mergeDemoConfig(DEFAULT_DEMO_CONFIG, userCfg);
      }
    } catch {
      /* defaults */
    }
    appState.demoConfig = demoCfg;
    appState.motionSmoother = createMotionSmoother(demoCfg.smoothing ?? {});
    appState.mocapForward = createMocapForward(demoCfg.forward ?? {});

    const webcam = await initWebcam(webcamMount, {
      videoProfile: demoCfg.webcam?.videoProfile ?? "standard",
      objectFit: demoCfg.webcam?.objectFit ?? "contain",
      digitalZoom: demoCfg.webcam?.digitalZoom ?? 1,
    });
    appState.webcam = webcam;

    const sceneRuntime = createSceneRuntime(avatarMount);
    sceneRuntime.start();
    appState.sceneRuntime = sceneRuntime;

    await loadAvatar(getAvatarModelPath(avatarId));

    const configLog =
      `Camera: ${webcam.video.videoWidth}×${webcam.video.videoHeight}\n` +
      "3D scene ready.\n" +
      `Smoothing: ${demoCfg.smoothing?.mode ?? "oneEuro"}\n` +
      `Holistic detectMaxWidth: ${demoCfg.holistic?.detectMaxWidth ?? 0}\n` +
      `swapHandSides: ${Boolean(demoCfg.tracking?.swapHandSides)}\n` +
      `mirrorInference: ${demoCfg.tracking?.mirrorInference !== false}\n` +
      "Loading gesture model…";

    setLog(configLog);
    setStatus("Camera ready");

    try {
      const gestureConfig = await fetch(
        "/assets/models/gesture/gesture-model.json"
      ).then((r) => r.json());
      appState.gestureConfig = gestureConfig;
      const gestureClassifier = createGestureClassifier(gestureConfig);
      await gestureClassifier.init();
      appState.gestureClassifier = gestureClassifier;
      const snap = gestureClassifier.getSnapshot();
      setLog(
        `${configLog}\nGesture CNN: ${
          snap.enabled ? "ready" : `disabled (${snap.disabledReason})`
        }`
      );
    } catch (gestureError) {
      console.warn(gestureError);
      setLog(
        `${configLog}\nGesture CNN: disabled — ` +
          (gestureError?.message ?? String(gestureError))
      );
    }

    const trackingHandle = await initHolisticTracking({
      video: webcam.video,
      stage: webcam.stage,
      onLog: setLog,
      onFrame: renderTrackingResult,
      detectMaxWidth: demoCfg.holistic?.detectMaxWidth ?? 0,
      trackingOptions: {},
      getTrackingOptions: () => ({
        swapHandSides: Boolean(appState.demoConfig.tracking?.swapHandSides),
        mirrorInference: appState.demoConfig.tracking?.mirrorInference !== false,
      }),
    });
    appState.trackingHandle = trackingHandle;

    setStatus("Running");
  } catch (error) {
    console.error(error);
    setStatus("Boot failed");
    setLog(`Startup failed: ${error.name}: ${error.message}`);
  }

  return {
    async setAvatarId(nextId) {
      await loadAvatar(getAvatarModelPath(nextId));
    },

    destroy() {
      appState.destroyed = true;
      appState.trackingHandle?.stop?.();
      appState.sceneRuntime?.dispose?.();
      webcamMount.innerHTML = "";
      avatarMount.innerHTML = "";
    },
  };
}
