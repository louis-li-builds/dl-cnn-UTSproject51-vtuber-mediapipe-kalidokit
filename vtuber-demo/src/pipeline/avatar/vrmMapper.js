import {
  calibrateWrist,
  kalidokitWristRotation,
} from "../motion/handPose.js";
import {
  makeCnnFixedFingerPose,
  makeFingerCurlPose,
  makeFingerOpenPose,
  makeThumbCurlPose,
  makeThumbOpenPose,
} from "./gestureFingerPoses.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safe(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function remapBlink(value) {
  const x = safe(value, 0);
  const shifted = (x - 0.08) / 0.28;
  return clamp(shifted * 1.8, 0, 1);
}

function remapMouth(value) {
  const x = safe(value, 0);
  return clamp((x - 0.02) * 1.6, 0, 1);
}

function safeRot(rot) {
  return {
    x: safe(rot?.x, 0),
    y: safe(rot?.y, 0),
    z: safe(rot?.z, 0),
  };
}

function remapUpperArmLiftLegacy(value, side) {
  const angle = safe(value, 90);
  const deg = clamp(angle - 90, -100, 100);
  const rad = degToRad(deg);
  return side === "left" ? -rad : rad;
}

function remapElbowLegacy(value, side) {
  const angle = safe(value, 180);
  let bend = 180 - angle;
  bend = Math.max(0, bend - 12);
  const deg = clamp(bend * 1.1, 0, 120);
  const rad = degToRad(deg);
  return side === "left" ? -rad : rad;
}

function getUpperArmRotation(motionState, side) {
  const body = motionState.upper_body ?? {};

  if (side === "left" && body.left_upper_arm) {
    const rot = safeRot(body.left_upper_arm);
    return {
      x: clamp(rot.x * 0.75, -1.2, 1.2),
      y: clamp(rot.y * 0.75, -1.2, 1.2),
      z: clamp(rot.z * 0.75, -1.5, 1.5),
    };
  }

  if (side === "right" && body.right_upper_arm) {
    const rot = safeRot(body.right_upper_arm);
    return {
      x: clamp(rot.x * 0.75, -1.2, 1.2),
      y: clamp(rot.y * 0.75, -1.2, 1.2),
      z: clamp(rot.z * 0.75, -1.5, 1.5),
    };
  }

  const lift =
    side === "left" ? body.left_upper_arm_lift : body.right_upper_arm_lift;

  return {
    x: 0,
    y: 0,
    z: remapUpperArmLiftLegacy(lift, side),
  };
}

const LOWER_ARM_UPDOWN_SCALE = 0.6;
const LOWER_ARM_SIDE_Y_SCALE = 2.0;
const LOWER_ARM_SIDE_Z_SCALE = 1.3;
const LOWER_ARM_LEFT_LIFT_OFFSET = 0.6;
const LOWER_ARM_RIGHT_LIFT_OFFSET = 0.6;
const LOWER_ARM_ELBOW_BEND_SCALE = 0.58;

function getLowerArmRotation(motionState, side) {
  const body = motionState.upper_body ?? {};

  const liftOffset =
    side === "left"
      ? LOWER_ARM_LEFT_LIFT_OFFSET
      : LOWER_ARM_RIGHT_LIFT_OFFSET;

  const lowerArmRot =
    side === "left" ? body.left_lower_arm : body.right_lower_arm;

  if (lowerArmRot) {
    const rot = safeRot(lowerArmRot);

    return {
      x: clamp(rot.x * LOWER_ARM_UPDOWN_SCALE + liftOffset, -1.4, 1.4),
      y: clamp(rot.y * LOWER_ARM_SIDE_Y_SCALE, -1.4, 1.4),
      z: clamp(rot.z * LOWER_ARM_SIDE_Z_SCALE, -1.4, 1.4),
    };
  }

  const elbow =
    side === "left" ? body.left_elbow_angle : body.right_elbow_angle;

  return {
    x: liftOffset,
    y: 0,
    z: clamp(remapElbowLegacy(elbow, side) * LOWER_ARM_ELBOW_BEND_SCALE, -1.4, 1.4),
  };
}

function handUsesCnnPose(handState) {
  return Boolean(handState?.gesture_cnn_active);
}

function getHandRotation(motionState, side) {
  const hand =
    side === "left" ? motionState.hands?.left : motionState.hands?.right;

  if (handUsesCnnPose(hand)) {
    return { x: 0, y: 0, z: 0 };
  }

  const kkWrist = kalidokitWristRotation(hand?.kalidokit, side);
  if (
    kkWrist &&
    (Number.isFinite(kkWrist.x) ||
      Number.isFinite(kkWrist.y) ||
      Number.isFinite(kkWrist.z))
  ) {
    return calibrateWrist(kkWrist, side);
  }

  const hasWristRot =
    Number.isFinite(hand?.wrist_rot?.x) ||
    Number.isFinite(hand?.wrist_rot?.y) ||
    Number.isFinite(hand?.wrist_rot?.z);

  if (hasWristRot) {
    return calibrateWrist(hand.wrist_rot, side);
  }

  const wristAngle = hand?.wrist_angle;
  if (!Number.isFinite(wristAngle)) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: 0,
    y: 0,
    z: degToRad(wristAngle) * 0.35,
  };
}

function makeThumbCurl(curl, side) {
  const c = clamp(safe(curl, 0), 0, 1);
  if (c <= 0.05) return makeThumbOpenPose(side);
  return makeThumbCurlPose(side, c);
}

function makeFingerCurl(curl, side) {
  const c = clamp(safe(curl, 0), 0, 1);
  if (c <= 0.05) return makeFingerOpenPose();
  if (c < 0.65) return makeFingerCurlPose(side, 0.55);
  return makeFingerCurlPose(side, c);
}

function makeHandFingerPoseFromCurl(handState, side) {
  return {
    thumb: makeThumbCurl(handState?.finger_curl?.thumb, side),
    index: makeFingerCurl(handState?.finger_curl?.index, side),
    middle: makeFingerCurl(handState?.finger_curl?.middle, side),
    ring: makeFingerCurl(handState?.finger_curl?.ring, side),
    little: makeFingerCurl(handState?.finger_curl?.pinky, side),
  };
}

function makeHandFingerPose(handState, side) {
  const cnnGesture = handState?.gesture_cnn_active;
  const cnnPose = makeCnnFixedFingerPose(cnnGesture, side);
  if (cnnPose) {
    return cnnPose;
  }

  return makeHandFingerPoseFromCurl(handState, side);
}

export function mapMotionStateToAvatarState(motionState) {
  const leftHand = motionState.hands?.left;
  const rightHand = motionState.hands?.right;

  return {
    lookAt: {
      yaw: safe(motionState.face?.head_yaw, 0),
      pitch: safe(motionState.face?.head_pitch, 0),
    },

    expressions: {
      blinkLeft: remapBlink(motionState.face?.blink_left),
      blinkRight: remapBlink(motionState.face?.blink_right),
      aa: remapMouth(motionState.face?.mouth_open),
      ih: 0,
      ou: 0,
      ee: 0,
      oh: 0,
    },

    bones: {
      head: {
        x: safe(motionState.face?.head_pitch, 0),
        y: safe(motionState.face?.head_yaw, 0),
        z: safe(motionState.face?.head_roll, 0),
      },

      leftUpperArm: getUpperArmRotation(motionState, "left"),
      rightUpperArm: getUpperArmRotation(motionState, "right"),

      leftLowerArm: getLowerArmRotation(motionState, "left"),
      rightLowerArm: getLowerArmRotation(motionState, "right"),

      leftHand: getHandRotation(motionState, "left"),
      rightHand: getHandRotation(motionState, "right"),
    },

    fingers: {
      left: makeHandFingerPose(leftHand, "left"),
      right: makeHandFingerPose(rightHand, "right"),
    },
  };
}
