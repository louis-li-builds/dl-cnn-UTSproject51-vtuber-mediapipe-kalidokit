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
    return safeRot(body.left_upper_arm);
  }
  if (side === "right" && body.right_upper_arm) {
    return safeRot(body.right_upper_arm);
  }

  const lift =
    side === "left" ? body.left_upper_arm_lift : body.right_upper_arm_lift;

  return {
    x: 0,
    y: 0,
    z: remapUpperArmLiftLegacy(lift, side),
  };
}

function getLowerArmRotation(motionState, side) {
  const body = motionState.upper_body ?? {};

  if (side === "left" && body.left_lower_arm) {
    return safeRot(body.left_lower_arm);
  }
  if (side === "right" && body.right_lower_arm) {
    return safeRot(body.right_lower_arm);
  }

  const elbow =
    side === "left" ? body.left_elbow_angle : body.right_elbow_angle;

  return {
    x: 0,
    y: 0,
    z: remapElbowLegacy(elbow, side),
  };
}

function calibrateWrist(rot, side) {
  const x = safe(rot?.x, 0);
  const y = safe(rot?.y, 0);
  const z = safe(rot?.z, 0);

  if (side === "left") {
    return {
      x: clamp(-x * 0.85, -1.0, 1.0),
      y: clamp(y * 0.65, -0.8, 0.8),
      z: clamp(-z * 0.9, -1.2, 1.2),
    };
  }

  return {
    x: clamp(x * 0.85, -1.0, 1.0),
    y: clamp(-y * 0.65, -0.8, 0.8),
    z: clamp(z * 0.9, -1.2, 1.2),
  };
}

/**
 * Wrist on the avatar:
 * - `wrist_angle` (2D, from landmarks) is usually the most stable “in-plane” roll.
 * - `wrist_rot` (3D heuristic) adds tilt but picks up noise → blend, do not let it fully own the joint.
 */
function getHandRotation(motionState, side) {
  const hand = side === "left" ? motionState.hands?.left : motionState.hands?.right;

  const wristAngle = hand?.wrist_angle;
  const baseZ = Number.isFinite(wristAngle) ? degToRad(wristAngle) : 0;

  const hasFullWristRot =
    Number.isFinite(hand?.wrist_rot?.x) &&
    Number.isFinite(hand?.wrist_rot?.y) &&
    Number.isFinite(hand?.wrist_rot?.z);

  if (!hasFullWristRot && !Number.isFinite(wristAngle)) {
    return { x: 0, y: 0, z: 0 };
  }

  if (hasFullWristRot) {
    const wr = calibrateWrist(hand.wrist_rot, side);
    if (Number.isFinite(wristAngle)) {
      return {
        x: wr.x * 0.32,
        y: wr.y * 0.32,
        z: clamp(baseZ * 0.72 + wr.z * 0.28, -1.35, 1.35),
      };
    }
    return wr;
  }

  return { x: 0, y: 0, z: baseZ };
}

/** Tuning: raise multipliers if fingers still look “dead”; lower if they over-bend or clip. */
const FINGER_GAIN = 1.38;

function makeThumbCurl(curl, side) {
  const c = clamp(safe(curl, 0), 0, 1) * FINGER_GAIN;
  const spread = side === "left" ? 1 : -1;

  return {
    metacarpal: {
      x: 0,
      y: clamp(spread * 0.22 * c, -0.55, 0.55),
      z: clamp(-0.18 * c, -0.85, 0.85),
    },
    proximal: {
      x: 0,
      y: 0,
      z: clamp(-0.42 * c, -1.15, 1.15),
    },
    distal: {
      x: 0,
      y: 0,
      z: clamp(-0.30 * c, -0.95, 0.95),
    },
  };
}

function makeFingerCurl(curl) {
  const c = clamp(safe(curl, 0), 0, 1) * FINGER_GAIN;

  return {
    proximal: {
      x: 0,
      y: 0,
      z: clamp(-0.55 * c, -1.35, 1.35),
    },
    intermediate: {
      x: 0,
      y: 0,
      z: clamp(-0.90 * c, -1.85, 1.85),
    },
    distal: {
      x: 0,
      y: 0,
      z: clamp(-0.55 * c, -1.35, 1.35),
    },
  };
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
      left: {
        thumb: makeThumbCurl(leftHand?.finger_curl?.thumb, "left"),
        index: makeFingerCurl(leftHand?.finger_curl?.index),
        middle: makeFingerCurl(leftHand?.finger_curl?.middle),
        ring: makeFingerCurl(leftHand?.finger_curl?.ring),
        little: makeFingerCurl(leftHand?.finger_curl?.pinky),
      },
      right: {
        thumb: makeThumbCurl(rightHand?.finger_curl?.thumb, "right"),
        index: makeFingerCurl(rightHand?.finger_curl?.index),
        middle: makeFingerCurl(rightHand?.finger_curl?.middle),
        ring: makeFingerCurl(rightHand?.finger_curl?.ring),
        little: makeFingerCurl(rightHand?.finger_curl?.pinky),
      },
    },
  };
}
