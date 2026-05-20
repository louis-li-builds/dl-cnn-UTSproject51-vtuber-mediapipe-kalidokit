import { initWebcam } from "./tracking/webcam.js";
import { initHolisticTracking } from "./tracking/holistic.js";
import { buildMotionState } from "./motion/motionState.js";
import { createMotionSmoother } from "./motion/smoother.js";
import { createSceneRuntime } from "./render/scene.js";
import { loadVrmModel } from "./avatar/vrmLoader.js";
import { mapMotionStateToAvatarState } from "./avatar/vrmMapper.js";
import { applyAvatarStateToVrm } from "./avatar/vrmDriver.js";
import { getAvatarModelPath } from "./avatars.js";
import { patchRuntime } from "./runtimeStore.js";

function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "null";
  }
  return Number(value).toFixed(digits);
}

function formatMotionPanelText(trackingResult, motionState) {
  return `timestamp: ${Math.round(trackingResult.timestamp)}

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
left_elbow_angle: ${formatNumber(motionState.upper_body?.left_elbow_angle, 2)}
right_elbow_angle: ${formatNumber(motionState.upper_body?.right_elbow_angle, 2)}

[motion.hands.left]
wrist_angle: ${formatNumber(motionState.hands?.left?.wrist_angle, 2)}
gesture_basic: ${motionState.hands?.left?.gesture_basic ?? "null"}

[motion.hands.right]
wrist_angle: ${formatNumber(motionState.hands?.right?.wrist_angle, 2)}
gesture_basic: ${motionState.hands?.right?.gesture_basic ?? "null"}`;
}

/**
 * Boot MediaPipe + Kalidokit + VRM inside Figma shell mount points.
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
    destroyed: false,
  };

  const trackingOptions = { swapHandsForAvatar: true };

  const faceSmoother = createMotionSmoother({
    alpha: 0.35,
    wristRotSmoothAlpha: 0.19,
    fingerCurlSmoothAlpha: 0.52,
  });

  function setStatus(text) {
    patchRuntime({ status: text });
  }

  function setLog(text) {
    patchRuntime({ logText: text });
  }

  function renderTrackingResult(trackingResult) {
    if (appState.destroyed) return;

    const video = appState.webcam?.video ?? null;
    const rawMotionState = buildMotionState(trackingResult, video);
    const motionState = faceSmoother.update(rawMotionState);
    const avatarState = mapMotionStateToAvatarState(motionState);
    const currentVrm = appState.sceneRuntime?.currentVrm ?? null;

    if (currentVrm) {
      applyAvatarStateToVrm(currentVrm, avatarState);
    }

    patchRuntime({
      motionText: formatMotionPanelText(trackingResult, motionState),
    });
  }

  async function loadAvatar(modelPath) {
    const sceneRuntime = appState.sceneRuntime;
    if (!sceneRuntime) return;

    try {
      const vrm = await loadVrmModel(modelPath);
      if (appState.destroyed) {
        vrm?.scene?.traverse?.(() => {});
        return;
      }
      sceneRuntime.setVrm(vrm);
      setLog(`VRM loaded: ${modelPath}`);
    } catch (error) {
      console.error(error);
      setLog(`VRM load failed: ${error.message}`);
    }
  }

  try {
    setStatus("Booting…");
    setLog("Loading pipeline…\nRequesting camera…");

    const webcam = await initWebcam(webcamMount, { videoProfile: "standard" });
    appState.webcam = webcam;

    const sceneRuntime = createSceneRuntime(avatarMount);
    sceneRuntime.start();
    appState.sceneRuntime = sceneRuntime;

    await loadAvatar(getAvatarModelPath(avatarId));

    setLog(
      `Camera: ${webcam.video.videoWidth}×${webcam.video.videoHeight}\n` +
        "3D scene ready.\nStarting holistic tracker…"
    );
    setStatus("Camera ready");

    const trackingHandle = await initHolisticTracking({
      video: webcam.video,
      stage: webcam.stage,
      onLog: setLog,
      onFrame: renderTrackingResult,
      getTrackingOptions: () => trackingOptions,
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
