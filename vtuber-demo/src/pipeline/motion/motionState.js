import * as Kalidokit from "kalidokit";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value, fallback = null) {
  return Number.isFinite(value) ? value : fallback;
}

function getImageSize(video) {
  if (!video) {
    return { width: 0, height: 0 };
  }

  return {
    width: video.videoWidth || 0,
    height: video.videoHeight || 0,
  };
}

function safeRot(rot) {
  return {
    x: safeNumber(rot?.x, 0),
    y: safeNumber(rot?.y, 0),
    z: safeNumber(rot?.z, 0),
  };
}

function vec3Sub(a, b) {
  return {
    x: (a?.x ?? 0) - (b?.x ?? 0),
    y: (a?.y ?? 0) - (b?.y ?? 0),
    z: (a?.z ?? 0) - (b?.z ?? 0),
  };
}

function vec3Len(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function vec3Normalize(v) {
  const len = vec3Len(v);
  if (len < 1e-6) {
    return { x: 0, y: 0, z: 0 };
  }
  return {
    x: v.x / len,
    y: v.y / len,
    z: v.z / len,
  };
}

function vec3Cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function distance3D(a, b) {
  if (!a || !b) return 0;
  const dx = (a.x ?? 0) - (b.x ?? 0);
  const dy = (a.y ?? 0) - (b.y ?? 0);
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function calculateAngle3D(a, b, c) {
  if (!a || !b || !c) return null;

  const abx = (a.x ?? 0) - (b.x ?? 0);
  const aby = (a.y ?? 0) - (b.y ?? 0);
  const abz = (a.z ?? 0) - (b.z ?? 0);

  const cbx = (c.x ?? 0) - (b.x ?? 0);
  const cby = (c.y ?? 0) - (b.y ?? 0);
  const cbz = (c.z ?? 0) - (b.z ?? 0);

  const dot = abx * cbx + aby * cby + abz * cbz;
  const magAB = Math.sqrt(abx * abx + aby * aby + abz * abz);
  const magCB = Math.sqrt(cbx * cbx + cby * cby + cbz * cbz);

  if (magAB < 1e-6 || magCB < 1e-6) {
    return null;
  }

  const cosTheta = clamp(dot / (magAB * magCB), -1, 1);
  const radians = Math.acos(cosTheta);
  return radians * (180 / Math.PI);
}

function calculateElbowAngle(poseLandmarks, side) {
  if (!poseLandmarks || poseLandmarks.length === 0) {
    return null;
  }

  const INDEX = {
    left: { shoulder: 11, elbow: 13, wrist: 15 },
    right: { shoulder: 12, elbow: 14, wrist: 16 },
  };

  const idx = INDEX[side];
  if (!idx) return null;

  const shoulder = poseLandmarks[idx.shoulder];
  const elbow = poseLandmarks[idx.elbow];
  const wrist = poseLandmarks[idx.wrist];

  return calculateAngle3D(shoulder, elbow, wrist);
}

function solveFace(faceLandmarks, video = null) {
  if (!faceLandmarks || faceLandmarks.length === 0) {
    return {
      detected: false,
      raw: null,
      head_yaw: null,
      head_pitch: null,
      head_roll: null,
      blink_left: null,
      blink_right: null,
      eye_open_left: null,
      eye_open_right: null,
      mouth_open: null,
    };
  }

  const imageSize = getImageSize(video);

  const faceRig = Kalidokit.Face.solve(faceLandmarks, {
    runtime: "mediapipe",
    video,
    imageSize,
    smoothBlink: true,
    blinkSettings: [0.25, 0.75],
  });

  if (!faceRig) {
    return {
      detected: false,
      raw: null,
      head_yaw: null,
      head_pitch: null,
      head_roll: null,
      blink_left: null,
      blink_right: null,
      eye_open_left: null,
      eye_open_right: null,
      mouth_open: null,
    };
  }

  const headYaw = safeNumber(faceRig.head?.degrees?.y);
  const headPitch = safeNumber(faceRig.head?.degrees?.x);
  const headRoll = safeNumber(faceRig.head?.degrees?.z);

  const eyeLeftOpen = safeNumber(faceRig.eye?.l);
  const eyeRightOpen = safeNumber(faceRig.eye?.r);

  const blinkLeft =
    eyeLeftOpen === null ? null : clamp(1 - eyeLeftOpen, 0, 1);
  const blinkRight =
    eyeRightOpen === null ? null : clamp(1 - eyeRightOpen, 0, 1);

  const mouthOpen = safeNumber(faceRig.mouth?.y);

  return {
    detected: true,
    raw: faceRig,
    head_yaw: headYaw,
    head_pitch: headPitch,
    head_roll: headRoll,
    blink_left: blinkLeft,
    blink_right: blinkRight,
    eye_open_left: eyeLeftOpen,
    eye_open_right: eyeRightOpen,
    mouth_open: mouthOpen,
  };
}

function solvePose(poseLandmarks, poseWorldLandmarks, video = null) {
  if (!poseLandmarks || poseLandmarks.length === 0) {
    return {
      detected: false,
      raw: null,
    };
  }

  const imageSize = getImageSize(video);

  const poseRig = Kalidokit.Pose.solve(
    poseWorldLandmarks && poseWorldLandmarks.length > 0
      ? poseWorldLandmarks
      : poseLandmarks,
    poseLandmarks,
    {
      runtime: "mediapipe",
      video,
      imageSize,
      enableLegs: false,
    }
  );

  if (!poseRig) {
    return {
      detected: false,
      raw: null,
    };
  }

  return {
    detected: true,
    raw: poseRig,
  };
}

function calculateWristAngle2D(handLandmarks) {
  if (!handLandmarks || handLandmarks.length === 0) {
    return null;
  }

  const wrist = handLandmarks[0];
  const middleMcp = handLandmarks[9];

  if (!wrist || !middleMcp) {
    return null;
  }

  const dx = middleMcp.x - wrist.x;
  const dy = middleMcp.y - wrist.y;

  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return null;
  }

  return Math.atan2(dy, dx) * (180 / Math.PI);
}

const REGULAR_FINGER_INDEX = {
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};

function angleToCurl(angleDeg, openAngle, closedAngle) {
  if (angleDeg === null || angleDeg === undefined) {
    return null;
  }

  const curl =
    (openAngle - angleDeg) / (openAngle - closedAngle);

  return clamp(curl, 0, 1);
}

function weightedAverageAngle(angleItems) {
  const valid = angleItems.filter(
    (item) => item && item.angle !== null && item.angle !== undefined
  );

  if (valid.length === 0) {
    return null;
  }

  const totalWeight = valid.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight < 1e-6) {
    return null;
  }

  const weightedSum = valid.reduce(
    (sum, item) => sum + item.angle * item.weight,
    0
  );

  return weightedSum / totalWeight;
}

function calculateThumbCurl(handLandmarks) {
  if (!handLandmarks || handLandmarks.length < 21) {
    return null;
  }

  const wrist = handLandmarks[0];
  const cmc = handLandmarks[1];
  const mcp = handLandmarks[2];
  const ip = handLandmarks[3];
  const tip = handLandmarks[4];

  if (!wrist || !cmc || !mcp || !ip || !tip) {
    return null;
  }

  const baseAngle = calculateAngle3D(wrist, cmc, mcp);
  const midAngle = calculateAngle3D(cmc, mcp, ip);
  const tipAngle = calculateAngle3D(mcp, ip, tip);

  const avgAngle = weightedAverageAngle([
    { angle: baseAngle, weight: 0.40 },
    { angle: midAngle, weight: 0.35 },
    { angle: tipAngle, weight: 0.25 },
  ]);

  return angleToCurl(avgAngle, 155, 70);
}

function calculateRegularFingerCurl(handLandmarks, fingerName) {
  if (!handLandmarks || handLandmarks.length < 21) {
    return null;
  }

  const idx = REGULAR_FINGER_INDEX[fingerName];
  if (!idx) {
    return null;
  }

  const wrist = handLandmarks[0];
  const mcp = handLandmarks[idx[0]];
  const pip = handLandmarks[idx[1]];
  const dip = handLandmarks[idx[2]];
  const tip = handLandmarks[idx[3]];

  if (!wrist || !mcp || !pip || !dip || !tip) {
    return null;
  }

  const baseAngle = calculateAngle3D(wrist, mcp, pip);
  const midAngle = calculateAngle3D(mcp, pip, dip);
  const tipAngle = calculateAngle3D(pip, dip, tip);

  const avgAngle = weightedAverageAngle([
    { angle: baseAngle, weight: 0.20 },
    { angle: midAngle, weight: 0.50 },
    { angle: tipAngle, weight: 0.30 },
  ]);

  return angleToCurl(avgAngle, 170, 65);
}

function calculateAllFingerCurl(handLandmarks) {
  return {
    thumb: calculateThumbCurl(handLandmarks),
    index: calculateRegularFingerCurl(handLandmarks, "index"),
    middle: calculateRegularFingerCurl(handLandmarks, "middle"),
    ring: calculateRegularFingerCurl(handLandmarks, "ring"),
    pinky: calculateRegularFingerCurl(handLandmarks, "pinky"),
  };
}

function calculatePinchDistance(handLandmarks) {
  if (!handLandmarks || handLandmarks.length === 0) {
    return null;
  }

  const thumbTip = handLandmarks[4];
  const indexTip = handLandmarks[8];
  const indexMcp = handLandmarks[5];
  const pinkyMcp = handLandmarks[17];

  if (!thumbTip || !indexTip || !indexMcp || !pinkyMcp) {
    return null;
  }

  const tipDistance = distance3D(thumbTip, indexTip);
  const palmWidth = distance3D(indexMcp, pinkyMcp);

  if (palmWidth < 1e-6) {
    return null;
  }

  return tipDistance / palmWidth;
}

function classifyBasicGesture(fingerCurl, pinchDistance) {
  if (!fingerCurl) return "unknown";

  const values = Object.values(fingerCurl).filter((v) => v !== null);
  if (values.length === 0) return "unknown";

  const avgCurl =
    values.reduce((sum, v) => sum + v, 0) / values.length;

  if (
    pinchDistance !== null &&
    pinchDistance < 0.35 &&
    (fingerCurl.index ?? 1) < 0.5 &&
    (fingerCurl.thumb ?? 1) < 0.7
  ) {
    return "pinch";
  }

  if (
    (fingerCurl.index ?? 1) < 0.35 &&
    (fingerCurl.middle ?? 0) > 0.7 &&
    (fingerCurl.ring ?? 0) > 0.7 &&
    (fingerCurl.pinky ?? 0) > 0.7
  ) {
    return "point";
  }

  if (avgCurl > 0.75) {
    return "fist";
  }

  if (avgCurl < 0.35) {
    return "open";
  }

  return "mixed";
}

function estimateWristRotation(handLandmarks, handWorldLandmarks, side) {
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

  const xPitch = clamp(normal.y * 1.2, -0.9, 0.9);
  const yYaw = clamp(normal.x * 1.0, -0.9, 0.9);
  const z = clamp(zRoll, -1.4, 1.4);

  return {
    x: xPitch,
    y: yYaw,
    z,
  };
}

function solveHand(handLandmarks, handWorldLandmarks, side) {
  if (!handLandmarks || handLandmarks.length === 0) {
    return {
      detected: false,
      wrist_angle: null,
      wrist_rot: { x: null, y: null, z: null },
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
      raw: null,
    };
  }

  const fingerCurl = calculateAllFingerCurl(handLandmarks);

  const validCurl = Object.values(fingerCurl).filter((v) => v !== null);
  const avgCurl =
    validCurl.length > 0
      ? validCurl.reduce((sum, v) => sum + v, 0) / validCurl.length
      : null;

  const palmOpen = avgCurl === null ? null : 1 - avgCurl;
  const pinchDistance = calculatePinchDistance(handLandmarks);
  const gestureBasic = classifyBasicGesture(fingerCurl, pinchDistance);
  const wristAngle = calculateWristAngle2D(handLandmarks);
  const wristRot = estimateWristRotation(handLandmarks, handWorldLandmarks, side);

  return {
    detected: true,
    wrist_angle: wristAngle,
    wrist_rot: wristRot,
    palm_open: palmOpen,
    pinch_distance: pinchDistance,
    gesture_basic: gestureBasic,
    finger_curl: fingerCurl,
    raw: handLandmarks,
  };
}

export function buildMotionState(trackingResult, video = null) {
  const faceLandmarks = trackingResult.face?.landmarks ?? [];
  const poseLandmarks = trackingResult.pose?.landmarks ?? [];
  const poseWorldLandmarks = trackingResult.pose?.worldLandmarks ?? [];
  const leftHandLandmarks = trackingResult.hands?.left?.landmarks ?? [];
  const rightHandLandmarks = trackingResult.hands?.right?.landmarks ?? [];
  const leftHandWorldLandmarks = trackingResult.hands?.left?.worldLandmarks ?? [];
  const rightHandWorldLandmarks = trackingResult.hands?.right?.worldLandmarks ?? [];

  const face = solveFace(faceLandmarks, video);
  const pose = solvePose(poseLandmarks, poseWorldLandmarks, video);
  const leftHand = solveHand(leftHandLandmarks, leftHandWorldLandmarks, "left");
  const rightHand = solveHand(rightHandLandmarks, rightHandWorldLandmarks, "right");

  const leftElbowAngle = calculateElbowAngle(poseLandmarks, "left");
  const rightElbowAngle = calculateElbowAngle(poseLandmarks, "right");

  return {
    timestamp: trackingResult.timestamp,

    face: {
      detected: face.detected,
      head_yaw: face.head_yaw,
      head_pitch: face.head_pitch,
      head_roll: face.head_roll,
      blink_left: face.blink_left,
      blink_right: face.blink_right,
      eye_open_left: face.eye_open_left,
      eye_open_right: face.eye_open_right,
      mouth_open: face.mouth_open,
      raw: face.raw,
    },

    upper_body: {
      detected: pose.detected,
      left_upper_arm: safeRot(pose.raw?.LeftUpperArm),
      right_upper_arm: safeRot(pose.raw?.RightUpperArm),
      left_lower_arm: safeRot(pose.raw?.LeftLowerArm),
      right_lower_arm: safeRot(pose.raw?.RightLowerArm),
      left_elbow_angle: leftElbowAngle,
      right_elbow_angle: rightElbowAngle,
      raw: pose.raw,
    },

    hands: {
      left: leftHand,
      right: rightHand,
    },
  };
}
