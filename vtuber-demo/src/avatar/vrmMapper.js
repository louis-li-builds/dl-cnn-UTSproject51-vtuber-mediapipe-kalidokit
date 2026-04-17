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

function getHandRotation(motionState, side) {
  const hands = motionState.hands ?? {};

  const wristAngle =
    side === "left"
      ? hands.left?.wrist_angle
      : hands.right?.wrist_angle;

  if (!Number.isFinite(wristAngle)) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: 0,
    y: 0,
    z: degToRad(wristAngle),
  };
}

function getFingerValue(motionState, side, fingerName) {
  const hand = side === "left" ? motionState.hands?.left : motionState.hands?.right;
  return safe(hand?.finger_curl?.[fingerName], 0);
}

export function mapMotionStateToAvatarState(motionState) {
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
        thumb: getFingerValue(motionState, "left", "thumb"),
        index: getFingerValue(motionState, "left", "index"),
        middle: getFingerValue(motionState, "left", "middle"),
        ring: getFingerValue(motionState, "left", "ring"),
        pinky: getFingerValue(motionState, "left", "pinky"),
      },
      right: {
        thumb: getFingerValue(motionState, "right", "thumb"),
        index: getFingerValue(motionState, "right", "index"),
        middle: getFingerValue(motionState, "right", "middle"),
        ring: getFingerValue(motionState, "right", "ring"),
        pinky: getFingerValue(motionState, "right", "pinky"),
      },
    },
  };
}