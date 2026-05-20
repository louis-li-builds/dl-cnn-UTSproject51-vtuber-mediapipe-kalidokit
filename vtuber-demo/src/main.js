import { initWebcam } from "./tracking/webcam.js";
import { initHolisticTracking } from "./tracking/holistic.js";
import { buildMotionState } from "./motion/motionState.js";
import { createMotionSmoother } from "./motion/smoother.js";
import { createSceneRuntime } from "./render/scene.js";
import { loadVrmModel } from "./avatar/vrmLoader.js";
import { mapMotionStateToAvatarState } from "./avatar/vrmMapper.js";
import { applyAvatarStateToVrm } from "./avatar/vrmDriver.js";

const refs = {
  status: document.getElementById("status"),
  log: document.getElementById("log"),
  inputPanel: document.getElementById("input-panel"),
  avatarPanel: document.getElementById("avatar-panel"),
  motionPanel: document.getElementById("motion-panel"),
  debugPanel: document.getElementById("debug-panel"),
};

const appState = {
  webcam: null,
  sceneRuntime: null,
};

/** Passed into `buildTrackingResult` each frame（無 UI 時維持鏡像自拍常用設定） */
const trackingOptions = {
  /** Mirror selfie: swap which tracking channel drives avatar L/R */
  swapHandsForAvatar: true,
};

const faceSmoother = createMotionSmoother({
  alpha: 0.35,
  // Tune hand feel: lower wristRotSmoothAlpha → less wrist jitter; higher fingerCurlSmoothAlpha → snappier fingers
  wristRotSmoothAlpha: 0.19,
  fingerCurlSmoothAlpha: 0.52,
});

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

  const rawMotionState = buildMotionState(trackingResult, video);
  const motionState = faceSmoother.update(rawMotionState);

  const avatarState = mapMotionStateToAvatarState(motionState);
  const currentVrm = appState.sceneRuntime?.currentVrm ?? null;

  if (currentVrm) {
    applyAvatarStateToVrm(currentVrm, avatarState);
  }

  motionInfo.textContent = `timestamp: ${Math.round(trackingResult.timestamp)}

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
source: ${trackingResult.hands.left.source ?? "n/a"}

[tracking.hands.right]
detected: ${trackingResult.hands.right.detected}
count: ${trackingResult.hands.right.count}
worldCount: ${trackingResult.hands.right.worldCount ?? 0}
source: ${trackingResult.hands.right.source ?? "n/a"}

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
wrist_rot: x=${formatNumber(motionState.hands?.left?.wrist_rot?.x, 2)} y=${formatNumber(motionState.hands?.left?.wrist_rot?.y, 2)} z=${formatNumber(motionState.hands?.left?.wrist_rot?.z, 2)}
gesture_basic: ${motionState.hands?.left?.gesture_basic ?? "null"}
palm_open: ${formatNumber(motionState.hands?.left?.palm_open)}
pinch_distance: ${formatNumber(motionState.hands?.left?.pinch_distance)}
thumb_curl: ${formatNumber(motionState.hands?.left?.finger_curl?.thumb)}
index_curl: ${formatNumber(motionState.hands?.left?.finger_curl?.index)}
middle_curl: ${formatNumber(motionState.hands?.left?.finger_curl?.middle)}
ring_curl: ${formatNumber(motionState.hands?.left?.finger_curl?.ring)}
pinky_curl: ${formatNumber(motionState.hands?.left?.finger_curl?.pinky)}

[motion.hands.right]
wrist_angle: ${formatNumber(motionState.hands?.right?.wrist_angle, 2)}
wrist_rot: x=${formatNumber(motionState.hands?.right?.wrist_rot?.x, 2)} y=${formatNumber(motionState.hands?.right?.wrist_rot?.y, 2)} z=${formatNumber(motionState.hands?.right?.wrist_rot?.z, 2)}
gesture_basic: ${motionState.hands?.right?.gesture_basic ?? "null"}
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

    const webcamMount = document.getElementById("webcam-root");
    if (!webcamMount) {
      throw new Error("Missing #webcam-root mount inside input panel.");
    }

    const webcam = await initWebcam(webcamMount, { videoProfile: "standard" });
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

    await initHolisticTracking({
      video: webcam.video,
      stage: webcam.stage,
      onLog: setLog,
      onFrame: renderTrackingResult,
      getTrackingOptions: () => trackingOptions,
    });

    setStatus("Running");
  } catch (error) {
    console.error(error);
    setStatus("Boot failed");
    setLog(`Startup failed: ${error.name}: ${error.message}`);
  }
}

bootApp();