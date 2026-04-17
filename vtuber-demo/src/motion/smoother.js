function lerp(current, target, alpha) {
  return current + (target - current) * alpha;
}

function smoothNumber(prev, next, alpha) {
  if (next === null || next === undefined) return prev ?? null;
  if (prev === null || prev === undefined) return next;
  return lerp(prev, next, alpha);
}

function createEmptyHandState() {
  return {
    wrist_angle: null,
    palm_open: null,
    pinch_distance: null,
    gesture_basic: "unknown",
    finger_curl: {
      thumb: null,
      index: null,
      middle: null,
      ring: null,
      pinky: null,
    },
  };
}

function createEmptyRot() {
  return {
    x: null,
    y: null,
    z: null,
  };
}

function smoothRot(prevRot, nextRot, alpha) {
  return {
    x: smoothNumber(prevRot.x, nextRot?.x, alpha),
    y: smoothNumber(prevRot.y, nextRot?.y, alpha),
    z: smoothNumber(prevRot.z, nextRot?.z, alpha),
  };
}

function smoothHand(prevHand, nextHand, alpha) {
  if (!nextHand || !nextHand.detected) {
    return {
      detected: false,
      ...createEmptyHandState(),
      raw: null,
    };
  }

  return {
    ...nextHand,
    wrist_angle: smoothNumber(prevHand.wrist_angle, nextHand.wrist_angle, alpha),
    palm_open: smoothNumber(prevHand.palm_open, nextHand.palm_open, alpha),
    pinch_distance: smoothNumber(prevHand.pinch_distance, nextHand.pinch_distance, alpha),
    finger_curl: {
      thumb: smoothNumber(prevHand.finger_curl.thumb, nextHand.finger_curl.thumb, alpha),
      index: smoothNumber(prevHand.finger_curl.index, nextHand.finger_curl.index, alpha),
      middle: smoothNumber(prevHand.finger_curl.middle, nextHand.finger_curl.middle, alpha),
      ring: smoothNumber(prevHand.finger_curl.ring, nextHand.finger_curl.ring, alpha),
      pinky: smoothNumber(prevHand.finger_curl.pinky, nextHand.finger_curl.pinky, alpha),
    },
  };
}

export function createMotionSmoother(config = {}) {
  const alpha = config.alpha ?? 0.35;

  const state = {
    face: {
      head_yaw: null,
      head_pitch: null,
      head_roll: null,
      blink_left: null,
      blink_right: null,
      eye_open_left: null,
      eye_open_right: null,
      mouth_open: null,
    },
    upper_body: {
      left_upper_arm: createEmptyRot(),
      right_upper_arm: createEmptyRot(),
      left_lower_arm: createEmptyRot(),
      right_lower_arm: createEmptyRot(),
      left_elbow_angle: null,
      right_elbow_angle: null,
    },
    hands: {
      left: createEmptyHandState(),
      right: createEmptyHandState(),
    },
  };

  function update(motionState) {
    state.face.head_yaw = smoothNumber(state.face.head_yaw, motionState.face.head_yaw, alpha);
    state.face.head_pitch = smoothNumber(state.face.head_pitch, motionState.face.head_pitch, alpha);
    state.face.head_roll = smoothNumber(state.face.head_roll, motionState.face.head_roll, alpha);

    state.face.blink_left = smoothNumber(state.face.blink_left, motionState.face.blink_left, alpha);
    state.face.blink_right = smoothNumber(state.face.blink_right, motionState.face.blink_right, alpha);

    state.face.eye_open_left = smoothNumber(state.face.eye_open_left, motionState.face.eye_open_left, alpha);
    state.face.eye_open_right = smoothNumber(state.face.eye_open_right, motionState.face.eye_open_right, alpha);

    state.face.mouth_open = smoothNumber(state.face.mouth_open, motionState.face.mouth_open, alpha);

    state.upper_body.left_upper_arm = smoothRot(
      state.upper_body.left_upper_arm,
      motionState.upper_body.left_upper_arm,
      alpha
    );

    state.upper_body.right_upper_arm = smoothRot(
      state.upper_body.right_upper_arm,
      motionState.upper_body.right_upper_arm,
      alpha
    );

    state.upper_body.left_lower_arm = smoothRot(
      state.upper_body.left_lower_arm,
      motionState.upper_body.left_lower_arm,
      alpha
    );

    state.upper_body.right_lower_arm = smoothRot(
      state.upper_body.right_lower_arm,
      motionState.upper_body.right_lower_arm,
      alpha
    );

    state.upper_body.left_elbow_angle = smoothNumber(
      state.upper_body.left_elbow_angle,
      motionState.upper_body.left_elbow_angle,
      alpha
    );

    state.upper_body.right_elbow_angle = smoothNumber(
      state.upper_body.right_elbow_angle,
      motionState.upper_body.right_elbow_angle,
      alpha
    );

    state.hands.left = smoothHand(state.hands.left, motionState.hands.left, alpha);
    state.hands.right = smoothHand(state.hands.right, motionState.hands.right, alpha);

    return {
      ...motionState,
      face: {
        ...motionState.face,
        ...state.face,
      },
      upper_body: {
        ...motionState.upper_body,
        ...state.upper_body,
      },
      hands: {
        left: state.hands.left,
        right: state.hands.right,
      },
    };
  }

  return {
    update,
  };
}