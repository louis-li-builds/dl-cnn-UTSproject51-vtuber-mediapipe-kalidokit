import * as Kalidokit from "https://cdn.jsdelivr.net/npm/kalidokit@1.1.5/dist/kalidokit.es.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function vec3Sub(a, b) {
  return {
    x: (a?.x ?? 0) - (b?.x ?? 0),
    y: (a?.y ?? 0) - (b?.y ?? 0),
    z: (a?.z ?? 0) - (b?.z ?? 0),
  };
}

function vec3Normalize(v) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len < 1e-6) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function vec3Cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function safeRot(rot) {
  return {
    x: Number.isFinite(rot?.x) ? rot.x : 0,
    y: Number.isFinite(rot?.y) ? rot.y : 0,
    z: Number.isFinite(rot?.z) ? rot.z : 0,
  };
}

export function kalidokitSide(side) {
  return side === "left" ? "Left" : "Right";
}

/** Kalidokit kinematic hand rig (VRM-oriented radians). */
export function solveKalidokitHand(handLandmarks, side) {
  if (!handLandmarks || handLandmarks.length < 21) {
    return null;
  }

  try {
    return Kalidokit.Hand.solve(handLandmarks, kalidokitSide(side)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Palm normal from world landmarks (teammate skeleton) — stabilises wrist on avatar.
 */
export function estimateWristRotation(handLandmarks, handWorldLandmarks, side) {
  const lms =
    handWorldLandmarks && handWorldLandmarks.length >= 21
      ? handWorldLandmarks
      : handLandmarks;

  if (!lms || lms.length < 21) {
    return { x: null, y: null, z: null };
  }

  const wrist = lms[0];
  const indexMcp = lms[5];
  const middleMcp = lms[9];
  const pinkyMcp = lms[17];

  if (!wrist || !indexMcp || !middleMcp || !pinkyMcp) {
    return { x: null, y: null, z: null };
  }

  const across = vec3Normalize(vec3Sub(indexMcp, pinkyMcp));
  const forward = vec3Normalize(vec3Sub(middleMcp, wrist));
  let normal = vec3Normalize(vec3Cross(across, forward));

  if (side === "left") {
    normal = { x: -normal.x, y: -normal.y, z: -normal.z };
  }

  const imageWrist = handLandmarks?.[0];
  const imageMiddle = handLandmarks?.[9];

  let zRoll = 0;
  if (imageWrist && imageMiddle) {
    const dx = imageMiddle.x - imageWrist.x;
    const dy = imageMiddle.y - imageWrist.y;
    zRoll = -(Math.atan2(dy, dx) + Math.PI / 2);
  }

  return {
    x: clamp(normal.y * 1.2, -0.9, 0.9),
    y: clamp(normal.x * 1.0, -0.9, 0.9),
    z: clamp(zRoll, -1.4, 1.4),
  };
}

function pickRigRot(rig, prefix, segment) {
  const key = `${prefix}${segment}`;
  return safeRot(rig?.[key]);
}

/** Map Kalidokit rig keys to VRM finger chain used by vrmDriver. */
export function kalidokitRigToFingerPose(rig, side) {
  if (!rig) return null;

  const p = kalidokitSide(side);
  const thumbProx = pickRigRot(rig, p, "ThumbProximal");
  const thumbInter = pickRigRot(rig, p, "ThumbIntermediate");
  const thumbDist = pickRigRot(rig, p, "ThumbDistal");

  return {
    thumb: {
      metacarpal: thumbProx,
      proximal: thumbInter.x || thumbInter.y || thumbInter.z ? thumbInter : thumbProx,
      distal: thumbDist,
    },
    index: {
      proximal: pickRigRot(rig, p, "IndexProximal"),
      intermediate: pickRigRot(rig, p, "IndexIntermediate"),
      distal: pickRigRot(rig, p, "IndexDistal"),
    },
    middle: {
      proximal: pickRigRot(rig, p, "MiddleProximal"),
      intermediate: pickRigRot(rig, p, "MiddleIntermediate"),
      distal: pickRigRot(rig, p, "MiddleDistal"),
    },
    ring: {
      proximal: pickRigRot(rig, p, "RingProximal"),
      intermediate: pickRigRot(rig, p, "RingIntermediate"),
      distal: pickRigRot(rig, p, "RingDistal"),
    },
    little: {
      proximal: pickRigRot(rig, p, "LittleProximal"),
      intermediate: pickRigRot(rig, p, "LittleIntermediate"),
      distal: pickRigRot(rig, p, "LittleDistal"),
    },
  };
}

export function kalidokitWristRotation(rig, side) {
  if (!rig) return null;
  const p = kalidokitSide(side);
  return safeRot(rig[`${p}Wrist`]);
}

export function calibrateWrist(rot, side) {
  const x = rot?.x ?? 0;
  const y = rot?.y ?? 0;
  const z = rot?.z ?? 0;

  if (side === "left") {
    return {
      x: clamp(-x * 0.45, -0.7, 0.7),
      y: clamp(y * 0.35, -0.5, 0.5),
      z: clamp(-z * 0.55, -0.8, 0.8),
    };
  }

  return {
    x: clamp(x * 0.45, -0.7, 0.7),
    y: clamp(-y * 0.35, -0.5, 0.5),
    z: clamp(z * 0.55, -0.8, 0.8),
  };
}
