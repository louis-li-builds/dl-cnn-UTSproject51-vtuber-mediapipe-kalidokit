/**
 * Fixed VRM finger poses for CNN (HAGRID) and teammate RPS labels.
 * Used when gesture_cnn_active / RPS activeGesture is set; otherwise landmarks drive curl.
 */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function makeThumbOpenPose(side) {
  const spreadSign = side === "left" ? 1 : -1;
  const curlSign = side === "left" ? 1 : -1;

  return {
    metacarpal: { x: 0.0, y: spreadSign * 0.18, z: curlSign * 0.08 },
    proximal: { x: 0.0, y: 0, z: curlSign * 0.05 },
    distal: { x: 0.0, y: 0, z: curlSign * 0.03 },
  };
}

export function makeThumbCurlPose(side, strength = 1.0) {
  const c = clamp(strength, 0, 1);
  const spreadSign = side === "left" ? 1 : -1;
  const curlSign = side === "left" ? 1 : -1;

  return {
    metacarpal: { x: 0.18 * c, y: spreadSign * 0.35 * c, z: curlSign * 0.3 * c },
    proximal: { x: 0.28 * c, y: 0, z: curlSign * 0.65 * c },
    distal: { x: 0.22 * c, y: 0, z: curlSign * 0.45 * c },
  };
}

export function makeFingerOpenPose() {
  return {
    proximal: { x: 0, y: 0, z: 0 },
    intermediate: { x: 0, y: 0, z: 0 },
    distal: { x: 0, y: 0, z: 0 },
  };
}

export function makeFingerCurlPose(side, strength = 1.0) {
  const c = clamp(strength, 0, 1);
  const curlSign = side === "left" ? 1 : -1;

  return {
    proximal: { x: 0.45 * c, y: 0, z: curlSign * 1.05 * c },
    intermediate: { x: 0.65 * c, y: 0, z: curlSign * 1.45 * c },
    distal: { x: 0.38 * c, y: 0, z: curlSign * 1.05 * c },
  };
}

/** Thumb extended up (like). */
function makeThumbUpPose(side) {
  const spreadSign = side === "left" ? 1 : -1;
  const curlSign = side === "left" ? -1 : 1;

  return {
    metacarpal: { x: -0.35, y: spreadSign * 0.12, z: curlSign * 0.15 },
    proximal: { x: -0.2, y: 0, z: curlSign * 0.25 },
    distal: { x: -0.1, y: 0, z: curlSign * 0.12 },
  };
}

/** Thumb down (dislike). */
function makeThumbDownPose(side) {
  const spreadSign = side === "left" ? 1 : -1;
  const curlSign = side === "left" ? 1 : -1;

  return {
    metacarpal: { x: 0.42, y: spreadSign * 0.1, z: curlSign * 0.35 },
    proximal: { x: 0.35, y: 0, z: curlSign * 0.55 },
    distal: { x: 0.2, y: 0, z: curlSign * 0.4 },
  };
}

/** OK ring: thumb + index curled toward each other. */
function makeOkPose(side) {
  const curlSign = side === "left" ? 1 : -1;

  return {
    thumb: {
      metacarpal: { x: 0.12, y: 0, z: curlSign * 0.35 },
      proximal: { x: 0.22, y: curlSign * 0.2, z: curlSign * 0.5 },
      distal: { x: 0.15, y: 0, z: curlSign * 0.35 },
    },
    index: makeFingerCurlPose(side, 0.72),
    middle: makeFingerCurlPose(side, 1.0),
    ring: makeFingerCurlPose(side, 1.0),
    little: makeFingerCurlPose(side, 1.0),
  };
}

/** Shaka / call: thumb + pinky out. */
function makeCallPose(side) {
  return {
    thumb: makeThumbOpenPose(side),
    index: makeFingerCurlPose(side, 1.0),
    middle: makeFingerCurlPose(side, 1.0),
    ring: makeFingerCurlPose(side, 1.0),
    little: makeFingerOpenPose(),
  };
}

/**
 * @param {string} gesture HAGRID label or RPS rock|paper|scissors
 * @param {"left"|"right"} side
 * @returns {object|null} VRM finger pose block
 */
export function makeFixedGestureFingerPose(gesture, side) {
  if (!gesture || !side) return null;

  const g = gesture === "paper" ? "palm" : gesture === "scissors" ? "peace" : gesture;

  if (g === "rock") {
    return {
      thumb: makeThumbCurlPose(side, 0.95),
      index: makeFingerCurlPose(side, 1.0),
      middle: makeFingerCurlPose(side, 1.0),
      ring: makeFingerCurlPose(side, 1.0),
      little: makeFingerCurlPose(side, 1.0),
    };
  }

  if (g === "palm" || g === "stop") {
    return {
      thumb: makeThumbOpenPose(side),
      index: makeFingerOpenPose(),
      middle: makeFingerOpenPose(),
      ring: makeFingerOpenPose(),
      little: makeFingerOpenPose(),
    };
  }

  if (g === "peace") {
    return {
      thumb: makeThumbCurlPose(side, 0.5),
      index: makeFingerOpenPose(),
      middle: makeFingerOpenPose(),
      ring: makeFingerCurlPose(side, 1.0),
      little: makeFingerCurlPose(side, 1.0),
    };
  }

  if (g === "fist" || g === "mute") {
    return {
      thumb: makeThumbCurlPose(side, 1.0),
      index: makeFingerCurlPose(side, 1.0),
      middle: makeFingerCurlPose(side, 1.0),
      ring: makeFingerCurlPose(side, 1.0),
      little: makeFingerCurlPose(side, 1.0),
    };
  }

  if (g === "one") {
    return {
      thumb: makeThumbCurlPose(side, 0.7),
      index: makeFingerOpenPose(),
      middle: makeFingerCurlPose(side, 1.0),
      ring: makeFingerCurlPose(side, 1.0),
      little: makeFingerCurlPose(side, 1.0),
    };
  }

  if (g === "four") {
    return {
      thumb: makeThumbCurlPose(side, 0.65),
      index: makeFingerOpenPose(),
      middle: makeFingerOpenPose(),
      ring: makeFingerOpenPose(),
      little: makeFingerCurlPose(side, 1.0),
    };
  }

  if (g === "like") {
    return {
      thumb: makeThumbUpPose(side),
      index: makeFingerCurlPose(side, 1.0),
      middle: makeFingerCurlPose(side, 1.0),
      ring: makeFingerCurlPose(side, 1.0),
      little: makeFingerCurlPose(side, 1.0),
    };
  }

  if (g === "dislike") {
    return {
      thumb: makeThumbDownPose(side),
      index: makeFingerCurlPose(side, 1.0),
      middle: makeFingerCurlPose(side, 1.0),
      ring: makeFingerCurlPose(side, 1.0),
      little: makeFingerCurlPose(side, 1.0),
    };
  }

  if (g === "ok") {
    return makeOkPose(side);
  }

  if (g === "call") {
    return makeCallPose(side);
  }

  return null;
}
