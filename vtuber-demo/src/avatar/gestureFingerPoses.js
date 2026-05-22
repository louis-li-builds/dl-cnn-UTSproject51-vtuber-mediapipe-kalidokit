/**
 * Fixed VRM finger poses for CNN gesture override (same idea as teammate RPS demo).
 * @see exp3 skeleton vrmMapper makeRpsFixedFingerPose
 */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function makeThumbOpenPose(side) {
  const spreadSign = side === "left" ? 1 : -1;
  const curlSign = side === "left" ? 1 : -1;

  return {
    metacarpal: { x: 0, y: spreadSign * 0.18, z: curlSign * 0.08 },
    proximal: { x: 0, y: 0, z: curlSign * 0.05 },
    distal: { x: 0, y: 0, z: curlSign * 0.03 },
  };
}

export function makeThumbCurlPose(side, strength = 1) {
  const c = clamp(strength, 0, 1);
  const spreadSign = side === "left" ? 1 : -1;
  const curlSign = side === "left" ? 1 : -1;

  return {
    metacarpal: {
      x: 0.18 * c,
      y: spreadSign * 0.35 * c,
      z: curlSign * 0.3 * c,
    },
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

export function makeFingerCurlPose(side, strength = 1) {
  const c = clamp(strength, 0, 1);
  const curlSign = side === "left" ? 1 : -1;

  return {
    proximal: { x: 0.45 * c, y: 0, z: curlSign * 1.05 * c },
    intermediate: { x: 0.65 * c, y: 0, z: curlSign * 1.45 * c },
    distal: { x: 0.38 * c, y: 0, z: curlSign * 1.05 * c },
  };
}

function poseFist(side) {
  return {
    thumb: makeThumbCurlPose(side, 0.95),
    index: makeFingerCurlPose(side, 1),
    middle: makeFingerCurlPose(side, 1),
    ring: makeFingerCurlPose(side, 1),
    little: makeFingerCurlPose(side, 1),
  };
}

function posePalm(side) {
  return {
    thumb: makeThumbOpenPose(side),
    index: makeFingerOpenPose(),
    middle: makeFingerOpenPose(),
    ring: makeFingerOpenPose(),
    little: makeFingerOpenPose(),
  };
}

function posePeace(side) {
  return {
    thumb: makeThumbCurlPose(side, 0.55),
    index: makeFingerOpenPose(),
    middle: makeFingerOpenPose(),
    ring: makeFingerCurlPose(side, 1),
    little: makeFingerCurlPose(side, 1),
  };
}

function poseScissors(side) {
  return {
    thumb: makeThumbCurlPose(side, 0.88),
    index: makeFingerOpenPose(),
    middle: makeFingerOpenPose(),
    ring: makeFingerCurlPose(side, 1),
    little: makeFingerCurlPose(side, 1),
  };
}

function poseOne(side) {
  return {
    thumb: makeThumbCurlPose(side, 0.6),
    index: makeFingerOpenPose(),
    middle: makeFingerCurlPose(side, 1),
    ring: makeFingerCurlPose(side, 1),
    little: makeFingerCurlPose(side, 1),
  };
}

function poseFour(side) {
  return {
    thumb: makeThumbCurlPose(side, 0.75),
    index: makeFingerOpenPose(),
    middle: makeFingerOpenPose(),
    ring: makeFingerOpenPose(),
    little: makeFingerOpenPose(),
  };
}

function poseOk(side) {
  const curlSign = side === "left" ? 1 : -1;
  return {
    thumb: makeThumbCurlPose(side, 0.65),
    index: {
      proximal: { x: 0.35, y: 0, z: curlSign * 0.75 },
      intermediate: { x: 0.45, y: 0, z: curlSign * 0.9 },
      distal: { x: 0.2, y: 0, z: curlSign * 0.4 },
    },
    middle: makeFingerOpenPose(),
    ring: makeFingerOpenPose(),
    little: makeFingerOpenPose(),
  };
}

function poseLike(side) {
  return {
    thumb: makeThumbOpenPose(side),
    index: makeFingerCurlPose(side, 0.9),
    middle: makeFingerCurlPose(side, 0.9),
    ring: makeFingerCurlPose(side, 0.9),
    little: makeFingerCurlPose(side, 0.9),
  };
}

function poseCall(side) {
  return {
    thumb: makeThumbOpenPose(side),
    index: makeFingerCurlPose(side, 0.85),
    middle: makeFingerCurlPose(side, 0.85),
    ring: makeFingerCurlPose(side, 0.85),
    little: makeFingerOpenPose(),
  };
}

function poseDislike(side) {
  const curlSign = side === "left" ? -1 : 1;
  return {
    thumb: {
      metacarpal: { x: 0.15, y: 0, z: curlSign * 0.5 },
      proximal: { x: 0.35, y: 0, z: curlSign * 0.85 },
      distal: { x: 0.25, y: 0, z: curlSign * 0.55 },
    },
    index: makeFingerCurlPose(side, 0.95),
    middle: makeFingerCurlPose(side, 0.95),
    ring: makeFingerCurlPose(side, 0.95),
    little: makeFingerCurlPose(side, 0.95),
  };
}

function poseMute(side) {
  return poseFist(side);
}

function poseStop(side) {
  return posePalm(side);
}

const POSE_BY_GESTURE = {
  fist: poseFist,
  rock: poseFist,
  palm: posePalm,
  paper: posePalm,
  peace: poseScissors,
  scissors: poseScissors,
  one: poseOne,
  four: poseFour,
  ok: poseOk,
  like: poseLike,
  call: poseCall,
  dislike: poseDislike,
  mute: poseMute,
  stop: poseStop,
};

/** @returns {object|null} VRM finger chain or null if no fixed pose */
export function makeCnnFixedFingerPose(gesture, side) {
  if (!gesture || !side) return null;
  const key = String(gesture).toLowerCase();
  const builder = POSE_BY_GESTURE[key];
  return builder ? builder(side) : null;
}

export const CNN_POSE_GESTURE_NAMES = Object.keys(POSE_BY_GESTURE);
