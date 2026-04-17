import * as Kalidokit from "https://cdn.jsdelivr.net/npm/kalidokit@1.1.5/dist/kalidokit.es.js";

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
    left: {
      shoulder: 11,
      elbow: 13,
      wrist: 15,
    },
    right: {
      shoulder: 12,
      elbow: 14,
      wrist: 16,
    },
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

function calculateFingerCurl(handLandmarks, fingerName) {
  if (!handLandmarks || handLandmarks.length === 0) {
    return null;
  }

  const FINGER_INDEX = {
    thumb: [1, 2, 3, 4],
    index: [5, 6, 7, 8],
    middle: [9, 10, 11, 12],
    ring: [13, 14, 15, 16],
    pinky: [17, 18, 19, 20],
  };

  const idx = FINGER_INDEX[fingerName];
  if (!idx) return null;

  const a = handLandmarks[idx[0]];
  const b = handLandmarks[idx[1]];
  const c = handLandmarks[idx[2]];
  const d = handLandmarks[idx[3]];

  if (!a || !b || !c || !d) {
    return null;
  }

  const angle1 = calculateAngle3D(a, b, c);
  const angle2 = calculateAngle3D(b, c, d);

  if (angle1 === null || angle2 === null) {
    return null;
  }

  const avgAngle = (angle1 + angle2) / 2;

  const OPEN_ANGLE = fingerName === "thumb" ? 155 : 170;
  const CLOSED_ANGLE = fingerName === "thumb" ? 80 : 70;

  const curl =
    (OPEN_ANGLE - avgAngle) / (OPEN_ANGLE - CLOSED_ANGLE);

  return clamp(curl, 0, 1);
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

function solveHand(handLandmarks) {
  if (!handLandmarks || handLandmarks.length === 0) {
    return {
      detected: false,
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
      raw: null,
    };
  }

  const fingerCurl = {
    thumb: calculateFingerCurl(handLandmarks, "thumb"),
    index: calculateFingerCurl(handLandmarks, "index"),
    middle: calculateFingerCurl(handLandmarks, "middle"),
    ring: calculateFingerCurl(handLandmarks, "ring"),
    pinky: calculateFingerCurl(handLandmarks, "pinky"),
  };

  const validCurl = Object.values(fingerCurl).filter((v) => v !== null);
  const avgCurl =
    validCurl.length > 0
      ? validCurl.reduce((sum, v) => sum + v, 0) / validCurl.length
      : null;

  const palmOpen = avgCurl === null ? null : 1 - avgCurl;
  const pinchDistance = calculatePinchDistance(handLandmarks);
  const gestureBasic = classifyBasicGesture(fingerCurl, pinchDistance);
  const wristAngle = calculateWristAngle2D(handLandmarks);

  return {
    detected: true,
    wrist_angle: wristAngle,
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

  const face = solveFace(faceLandmarks, video);
  const pose = solvePose(poseLandmarks, poseWorldLandmarks, video);
  const leftHand = solveHand(leftHandLandmarks);
  const rightHand = solveHand(rightHandLandmarks);

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