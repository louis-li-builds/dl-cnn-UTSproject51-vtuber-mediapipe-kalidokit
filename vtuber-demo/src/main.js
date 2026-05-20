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

const refs = {
  status: document.getElementById("status"),
  log: document.getElementById("log"),
  inputPanel: document.getElementById("input-panel"),
  avatarPanel: document.getElementById("avatar-panel"),
  motionPanel: document.getElementById("motion-panel"),
  debugPanel: document.getElementById("debug-panel"),
};

const DEFAULT_DEMO_CONFIG = {
  holistic: {
    detectMaxWidth: 640,
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

const appState = {
  webcam: null,
  sceneRuntime: null,
  gestureClassifier: null,
  gestureConfig: null,
  demoConfig: DEFAULT_DEMO_CONFIG,
  motionSmoother: null,
  mocapForward: null,
};

const motionInfo = document.createElement("pre");
motionInfo.style.whiteSpace = "pre-wrap";
motionInfo.style.fontFamily = "monospace";
motionInfo.style.fontSize = "12px";
motionInfo.style.lineHeight = "1.35";
motionInfo.style.margin = "0";
motionInfo.textContent = "Waiting for tracking data…";
refs.motionPanel.innerHTML = "<h2>Motion Parameters</h2>";
refs.motionPanel.appendChild(motionInfo);

function setStatus(text) {
  refs.status.textContent = text;
}

function setLog(text) {
  refs.log.textContent = text;
}

function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "null";
  }
  return Number(value).toFixed(digits);
}

function renderTrackingResult(trackingResult) {
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

  const cfg = appState.demoConfig ?? DEFAULT_DEMO_CONFIG;
  motionInfo.textContent = `timestamp: ${Math.round(trackingResult.timestamp)}
demo: holistic.maxW=${cfg.holistic?.detectMaxWidth ?? 0} smoothing=${cfg.smoothing?.mode ?? "?"}
forward: ${appState.mocapForward?.enabled ? cfg.forward?.url : "off"}

[tracking.face]
detected: ${trackingResult.face.detected}
count: ${trackingResult.face.count}

[tracking.pose]
detected: ${trackingResult.pose.detected}
count: ${trackingResult.pose.count}

[tracking.hands.left]
detected: ${trackingResult.hands.left.detected}
count: ${trackingResult.hands.left.count}

[tracking.hands.right]
detected: ${trackingResult.hands.right.detected}
count: ${trackingResult.hands.right.count}

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
left_elbow_angle: ${formatNumber(
    motionState.upper_body?.left_elbow_angle,
    2
  )}
right_elbow_angle: ${formatNumber(
    motionState.upper_body?.right_elbow_angle,
    2
  )}

[motion.hands.left]
wrist_angle: ${formatNumber(motionState.hands?.left?.wrist_angle, 2)}
gesture_basic: ${motionState.hands?.left?.gesture_basic ?? "null"}
gesture_cnn: ${motionState.hands?.left?.gesture_cnn ?? "null"}
gesture_cnn_active: ${motionState.hands?.left?.gesture_cnn_active ?? "null"}
gesture_cnn_conf: ${formatNumber(motionState.hands?.left?.gesture_cnn_confidence)}
palm_open: ${formatNumber(motionState.hands?.left?.palm_open)}
pinch_distance: ${formatNumber(motionState.hands?.left?.pinch_distance)}
thumb_curl: ${formatNumber(motionState.hands?.left?.finger_curl?.thumb)}
index_curl: ${formatNumber(motionState.hands?.left?.finger_curl?.index)}
middle_curl: ${formatNumber(motionState.hands?.left?.finger_curl?.middle)}
ring_curl: ${formatNumber(motionState.hands?.left?.finger_curl?.ring)}
pinky_curl: ${formatNumber(motionState.hands?.left?.finger_curl?.pinky)}

[motion.hands.right]
wrist_angle: ${formatNumber(motionState.hands?.right?.wrist_angle, 2)}
gesture_basic: ${motionState.hands?.right?.gesture_basic ?? "null"}
gesture_cnn: ${motionState.hands?.right?.gesture_cnn ?? "null"}
gesture_cnn_active: ${motionState.hands?.right?.gesture_cnn_active ?? "null"}
gesture_cnn_conf: ${formatNumber(motionState.hands?.right?.gesture_cnn_confidence)}
palm_open: ${formatNumber(motionState.hands?.right?.palm_open)}
pinch_distance: ${formatNumber(motionState.hands?.right?.pinch_distance)}
thumb_curl: ${formatNumber(motionState.hands?.right?.finger_curl?.thumb)}
index_curl: ${formatNumber(motionState.hands?.right?.finger_curl?.index)}
middle_curl: ${formatNumber(motionState.hands?.right?.finger_curl?.middle)}
ring_curl: ${formatNumber(motionState.hands?.right?.finger_curl?.ring)}
pinky_curl: ${formatNumber(motionState.hands?.right?.finger_curl?.pinky)}`;
}

async function bootApp() {
  try {
    setStatus("Booting…");
    setLog("Loading application modules…\nRequesting camera access…");

    let demoCfg = DEFAULT_DEMO_CONFIG;
    try {
      const res = await fetch("./demo-config.json");
      if (res.ok) {
        const userCfg = await res.json();
        demoCfg = mergeDemoConfig(DEFAULT_DEMO_CONFIG, userCfg);
      }
    } catch {
      /* use defaults */
    }
    appState.demoConfig = demoCfg;
    appState.motionSmoother = createMotionSmoother(demoCfg.smoothing ?? {});
    appState.mocapForward = createMocapForward(demoCfg.forward ?? {});

    const webcam = await initWebcam(refs.inputPanel);
    appState.webcam = webcam;

    const sceneRuntime = createSceneRuntime(refs.avatarPanel);
    sceneRuntime.start();
    appState.sceneRuntime = sceneRuntime;
    try {
      const vrm = await loadVrmModel("./assets/models/avatar.vrm");
      sceneRuntime.setVrm(vrm);

      setLog(
        `Camera: ${webcam.video.videoWidth}×${webcam.video.videoHeight}\n` +
          "3D scene ready.\n" +
          "VRM model loaded.\n" +
          `Smoothing: ${demoCfg.smoothing?.mode ?? "oneEuro"}\n` +
          `Holistic detectMaxWidth: ${demoCfg.holistic?.detectMaxWidth ?? 0}\n` +
          "Starting holistic tracker…"
      );
    } catch (vrmError) {
      console.error(vrmError);

      setLog(
        `Camera: ${webcam.video.videoWidth}×${webcam.video.videoHeight}\n` +
          "3D scene ready.\n" +
          `VRM load failed: ${vrmError.message}\n` +
          "Starting holistic tracker…"
      );
    }

    setStatus("Camera ready");

    try {
      const gestureConfig = await fetch(
        "./assets/models/gesture/gesture-model.json"
      ).then((r) => r.json());
      appState.gestureConfig = gestureConfig;
      const gestureClassifier = createGestureClassifier(gestureConfig);
      await gestureClassifier.init();
      appState.gestureClassifier = gestureClassifier;
      const snap = gestureClassifier.getSnapshot();
      setLog(
        (refs.log.textContent || "") +
          `\nGesture CNN (Set A Exp02): ${
            snap.enabled ? "ready" : `disabled (${snap.disabledReason})`
          }`
      );
    } catch (gestureError) {
      console.warn(gestureError);
      setLog(
        (refs.log.textContent || "") +
          `\nGesture CNN: disabled (${gestureError.message})`
      );
    }

    await initHolisticTracking({
      video: webcam.video,
      stage: webcam.stage,
      onLog: setLog,
      onFrame: renderTrackingResult,
      detectMaxWidth: demoCfg.holistic?.detectMaxWidth ?? 0,
    });

    setStatus("Running");
  } catch (error) {
    console.error(error);
    setStatus("Boot failed");
    setLog(`Startup failed: ${error.name}: ${error.message}`);
  }
}

bootApp();
