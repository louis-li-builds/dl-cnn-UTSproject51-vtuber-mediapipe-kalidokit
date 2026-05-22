import { OneEuroFilter1D } from "./oneEuro.js";

function lerp(current, target, alpha) {
  return current + (target - current) * alpha;
}

function smoothNumberLerp(prev, next, alpha) {
  if (next === null || next === undefined) return prev ?? null;
  if (prev === null || prev === undefined) return next;
  return lerp(prev, next, alpha);
}

function createEmptyHandState() {
  return {
    wrist_angle: null,
    wrist_rot: createEmptyRot(),
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

function smoothRotLerp(prevRot, nextRot, alpha) {
  const base = prevRot ?? createEmptyRot();
  return {
    x: smoothNumberLerp(base.x, nextRot?.x, alpha),
    y: smoothNumberLerp(base.y, nextRot?.y, alpha),
    z: smoothNumberLerp(base.z, nextRot?.z, alpha),
  };
}

function smoothHandLerp(prevHand, nextHand, alpha, nowMs, holdInactiveHandMs) {
  const lastSeenMs = prevHand?._lastSeenMs ?? 0;

  if (!nextHand || !nextHand.detected) {
    if (
      holdInactiveHandMs > 0 &&
      prevHand?.detected &&
      nowMs - lastSeenMs < holdInactiveHandMs
    ) {
      return { ...prevHand, detected: true, _lastSeenMs: lastSeenMs };
    }
    return {
      detected: false,
      ...createEmptyHandState(),
      raw: null,
      _lastSeenMs: 0,
    };
  }

  const pc = prevHand.finger_curl ?? createEmptyHandState().finger_curl;

  return {
    ...nextHand,
    _lastSeenMs: nowMs,
    wrist_angle: smoothNumberLerp(prevHand.wrist_angle, nextHand.wrist_angle, alpha),
    wrist_rot: smoothRotLerp(
      prevHand.wrist_rot ?? createEmptyRot(),
      nextHand.wrist_rot,
      alpha
    ),
    palm_open: smoothNumberLerp(prevHand.palm_open, nextHand.palm_open, alpha),
    pinch_distance: smoothNumberLerp(
      prevHand.pinch_distance,
      nextHand.pinch_distance,
      alpha
    ),
    finger_curl: {
      thumb: smoothNumberLerp(pc.thumb, nextHand.finger_curl.thumb, alpha),
      index: smoothNumberLerp(pc.index, nextHand.finger_curl.index, alpha),
      middle: smoothNumberLerp(pc.middle, nextHand.finger_curl.middle, alpha),
      ring: smoothNumberLerp(pc.ring, nextHand.finger_curl.ring, alpha),
      pinky: smoothNumberLerp(pc.pinky, nextHand.finger_curl.pinky, alpha),
    },
  };
}

/**
 * @param {object} config
 * @param {"lerp"|"oneEuro"} [config.mode] default oneEuro
 * @param {number} [config.alpha] lerp blend (0–1), default 0.3
 * @param {object} [config.oneEuro] { minCutoff, beta, dCutoff }
 * @param {number} [config.holdInactiveHandMs] keep last hand pose after lost detect (ms). Exp02 uses 0 so solo-hand does not drive the opposite avatar arm.
 */
export function createMotionSmoother(config = {}) {
  const mode = config.mode ?? "oneEuro";
  const alpha = config.alpha ?? 0.3;
  const holdInactiveHandMs =
    typeof config.holdInactiveHandMs === "number"
      ? config.holdInactiveHandMs
      : mode === "oneEuro"
        ? 220
        : 220;
  const euroCfg = {
    minCutoff: config.oneEuro?.minCutoff ?? 1.0,
    beta: config.oneEuro?.beta ?? 0.007,
    dCutoff: config.oneEuro?.dCutoff ?? 1.0,
  };

  const euroFilters = new Map();

  function resetPrefix(prefix) {
    for (const key of [...euroFilters.keys()]) {
      if (key.startsWith(prefix)) {
        euroFilters.get(key).reset();
        euroFilters.delete(key);
      }
    }
  }

  function euroFilter(key) {
    if (!euroFilters.has(key)) {
      euroFilters.set(
        key,
        new OneEuroFilter1D(euroCfg.minCutoff, euroCfg.beta, euroCfg.dCutoff)
      );
    }
    return euroFilters.get(key);
  }

  function smoothScalarEuro(key, prev, next, tSec) {
    if (next === null || next === undefined || !Number.isFinite(next)) {
      euroFilter(key).reset();
      return next ?? null;
    }
    if (prev === null || prev === undefined || !Number.isFinite(prev)) {
      euroFilter(key).reset();
      return euroFilter(key).filter(next, tSec);
    }
    return euroFilter(key).filter(next, tSec);
  }

  function smoothRotEuro(prefix, prevRot, nextRot, tSec) {
    const base = prevRot ?? createEmptyRot();
    return {
      x: smoothScalarEuro(`${prefix}.x`, base.x, nextRot?.x, tSec),
      y: smoothScalarEuro(`${prefix}.y`, base.y, nextRot?.y, tSec),
      z: smoothScalarEuro(`${prefix}.z`, base.z, nextRot?.z, tSec),
    };
  }

  function smoothHandEuro(prefix, prevHand, nextHand, tSec) {
    const nowMs = tSec * 1000;
    const lastSeenMs = prevHand?._lastSeenMs ?? 0;

    if (!nextHand || !nextHand.detected) {
      if (
        holdInactiveHandMs > 0 &&
        prevHand?.detected &&
        nowMs - lastSeenMs < holdInactiveHandMs
      ) {
        return { ...prevHand, detected: true, _lastSeenMs: lastSeenMs };
      }
      resetPrefix(`${prefix}.`);
      return {
        detected: false,
        ...createEmptyHandState(),
        raw: null,
        _lastSeenMs: 0,
      };
    }

    const pc = prevHand.finger_curl ?? createEmptyHandState().finger_curl;

    return {
      ...nextHand,
      _lastSeenMs: nowMs,
      wrist_angle: smoothScalarEuro(`${prefix}.wrist_angle`, prevHand.wrist_angle, nextHand.wrist_angle, tSec),
      wrist_rot: smoothRotEuro(`${prefix}.wrist_rot`, prevHand.wrist_rot, nextHand.wrist_rot, tSec),
      palm_open: smoothScalarEuro(`${prefix}.palm_open`, prevHand.palm_open, nextHand.palm_open, tSec),
      pinch_distance: smoothScalarEuro(
        `${prefix}.pinch_distance`,
        prevHand.pinch_distance,
        nextHand.pinch_distance,
        tSec
      ),
      finger_curl: {
        thumb: smoothScalarEuro(`${prefix}.curl.thumb`, pc.thumb, nextHand.finger_curl.thumb, tSec),
        index: smoothScalarEuro(`${prefix}.curl.index`, pc.index, nextHand.finger_curl.index, tSec),
        middle: smoothScalarEuro(`${prefix}.curl.middle`, pc.middle, nextHand.finger_curl.middle, tSec),
        ring: smoothScalarEuro(`${prefix}.curl.ring`, pc.ring, nextHand.finger_curl.ring, tSec),
        pinky: smoothScalarEuro(`${prefix}.curl.pinky`, pc.pinky, nextHand.finger_curl.pinky, tSec),
      },
    };
  }

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

  function timeSec(motionState) {
    const ms = motionState?.timestamp ?? performance.now();
    return ms / 1000;
  }

  function updateLerp(motionState) {
    const t = timeSec(motionState);
    void t;
    state.face.head_yaw = smoothNumberLerp(state.face.head_yaw, motionState.face.head_yaw, alpha);
    state.face.head_pitch = smoothNumberLerp(state.face.head_pitch, motionState.face.head_pitch, alpha);
    state.face.head_roll = smoothNumberLerp(state.face.head_roll, motionState.face.head_roll, alpha);
    state.face.blink_left = smoothNumberLerp(state.face.blink_left, motionState.face.blink_left, alpha);
    state.face.blink_right = smoothNumberLerp(state.face.blink_right, motionState.face.blink_right, alpha);
    state.face.eye_open_left = smoothNumberLerp(state.face.eye_open_left, motionState.face.eye_open_left, alpha);
    state.face.eye_open_right = smoothNumberLerp(state.face.eye_open_right, motionState.face.eye_open_right, alpha);
    state.face.mouth_open = smoothNumberLerp(state.face.mouth_open, motionState.face.mouth_open, alpha);

    state.upper_body.left_upper_arm = smoothRotLerp(
      state.upper_body.left_upper_arm,
      motionState.upper_body.left_upper_arm,
      alpha
    );
    state.upper_body.right_upper_arm = smoothRotLerp(
      state.upper_body.right_upper_arm,
      motionState.upper_body.right_upper_arm,
      alpha
    );
    state.upper_body.left_lower_arm = smoothRotLerp(
      state.upper_body.left_lower_arm,
      motionState.upper_body.left_lower_arm,
      alpha
    );
    state.upper_body.right_lower_arm = smoothRotLerp(
      state.upper_body.right_lower_arm,
      motionState.upper_body.right_lower_arm,
      alpha
    );
    state.upper_body.left_elbow_angle = smoothNumberLerp(
      state.upper_body.left_elbow_angle,
      motionState.upper_body.left_elbow_angle,
      alpha
    );
    state.upper_body.right_elbow_angle = smoothNumberLerp(
      state.upper_body.right_elbow_angle,
      motionState.upper_body.right_elbow_angle,
      alpha
    );

    const nowMs = motionState?.timestamp ?? performance.now();
    state.hands.left = smoothHandLerp(
      state.hands.left,
      motionState.hands.left,
      alpha,
      nowMs,
      holdInactiveHandMs
    );
    state.hands.right = smoothHandLerp(
      state.hands.right,
      motionState.hands.right,
      alpha,
      nowMs,
      holdInactiveHandMs
    );

    return mergeMotion(motionState);
  }

  function updateOneEuro(motionState) {
    const t = timeSec(motionState);

    state.face.head_yaw = smoothScalarEuro("face.head_yaw", state.face.head_yaw, motionState.face.head_yaw, t);
    state.face.head_pitch = smoothScalarEuro("face.head_pitch", state.face.head_pitch, motionState.face.head_pitch, t);
    state.face.head_roll = smoothScalarEuro("face.head_roll", state.face.head_roll, motionState.face.head_roll, t);
    state.face.blink_left = smoothScalarEuro("face.blink_left", state.face.blink_left, motionState.face.blink_left, t);
    state.face.blink_right = smoothScalarEuro("face.blink_right", state.face.blink_right, motionState.face.blink_right, t);
    state.face.eye_open_left = smoothScalarEuro(
      "face.eye_open_left",
      state.face.eye_open_left,
      motionState.face.eye_open_left,
      t
    );
    state.face.eye_open_right = smoothScalarEuro(
      "face.eye_open_right",
      state.face.eye_open_right,
      motionState.face.eye_open_right,
      t
    );
    state.face.mouth_open = smoothScalarEuro("face.mouth_open", state.face.mouth_open, motionState.face.mouth_open, t);

    state.upper_body.left_upper_arm = smoothRotEuro(
      "upper.left_upper_arm",
      state.upper_body.left_upper_arm,
      motionState.upper_body.left_upper_arm,
      t
    );
    state.upper_body.right_upper_arm = smoothRotEuro(
      "upper.right_upper_arm",
      state.upper_body.right_upper_arm,
      motionState.upper_body.right_upper_arm,
      t
    );
    state.upper_body.left_lower_arm = smoothRotEuro(
      "upper.left_lower_arm",
      state.upper_body.left_lower_arm,
      motionState.upper_body.left_lower_arm,
      t
    );
    state.upper_body.right_lower_arm = smoothRotEuro(
      "upper.right_lower_arm",
      state.upper_body.right_lower_arm,
      motionState.upper_body.right_lower_arm,
      t
    );
    state.upper_body.left_elbow_angle = smoothScalarEuro(
      "upper.left_elbow_angle",
      state.upper_body.left_elbow_angle,
      motionState.upper_body.left_elbow_angle,
      t
    );
    state.upper_body.right_elbow_angle = smoothScalarEuro(
      "upper.right_elbow_angle",
      state.upper_body.right_elbow_angle,
      motionState.upper_body.right_elbow_angle,
      t
    );

    state.hands.left = smoothHandEuro("hands.left", state.hands.left, motionState.hands.left, t);
    state.hands.right = smoothHandEuro("hands.right", state.hands.right, motionState.hands.right, t);

    return mergeMotion(motionState);
  }

  function mergeMotion(motionState) {
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
        left: mergeHand(motionState.hands?.left, state.hands.left),
        right: mergeHand(motionState.hands?.right, state.hands.right),
      },
    };
  }

  function mergeHand(raw, smoothedBlock) {
    if (!raw) return smoothedBlock ?? { detected: false };
    if (!smoothedBlock?.detected) {
      return {
        ...raw,
        ...smoothedBlock,
        detected: false,
      };
    }
    return {
      ...raw,
      ...smoothedBlock,
      gesture_basic: raw?.gesture_basic ?? smoothedBlock.gesture_basic,
      kalidokit: raw?.kalidokit ?? smoothedBlock.kalidokit,
      raw: raw?.raw ?? smoothedBlock.raw,
    };
  }

  function update(motionState) {
    if (mode === "lerp") {
      return updateLerp(motionState);
    }
    return updateOneEuro(motionState);
  }

  return { update, mode };
}
