import * as THREE from "three";
import {
  VRMExpressionPresetName,
  VRMHumanBoneName,
} from "@pixiv/three-vrm";

let lastFingerProbeVrm = null;

function logFingerHumanoidCoverageOnce(vrm, humanoid) {
  if (!vrm || !humanoid || lastFingerProbeVrm === vrm) return;
  lastFingerProbeVrm = vrm;

  const sample = [
    VRMHumanBoneName.LeftHand,
    VRMHumanBoneName.LeftThumbProximal,
    VRMHumanBoneName.LeftIndexProximal,
    VRMHumanBoneName.LeftMiddleProximal,
    VRMHumanBoneName.RightIndexProximal,
  ];

  const found = sample.filter((n) => humanoid.getNormalizedBoneNode(n)).length;

  console.info(
    "[vtuber-demo] VRM Humanoid finger sample:",
    `${found}/${sample.length} bones resolved.`,
    "If the motion panel shows changing thumb_curl / index_curl but the mesh does not move, this model may lack standard finger bones (or uses only blend-shape fingers)."
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safe(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function degToRadClamped(value, minDeg, maxDeg) {
  const clamped = clamp(safe(value, 0), minDeg, maxDeg);
  return THREE.MathUtils.degToRad(clamped);
}

function applyBoneEuler(node, rot, limits = null) {
  if (!node || !rot) return;

  if (!limits) {
    node.rotation.x = safe(rot.x, 0);
    node.rotation.y = safe(rot.y, 0);
    node.rotation.z = safe(rot.z, 0);
    return;
  }

  node.rotation.x = clamp(safe(rot.x, 0), limits.xMin, limits.xMax);
  node.rotation.y = clamp(safe(rot.y, 0), limits.yMin, limits.yMax);
  node.rotation.z = clamp(safe(rot.z, 0), limits.zMin, limits.zMax);
}

function fingerBoneName(side, finger, segment) {
  const s = side === "left" ? "Left" : "Right";

  if (finger === "thumb") {
    if (segment === "metacarpal") return VRMHumanBoneName[`${s}ThumbMetacarpal`];
    if (segment === "proximal") return VRMHumanBoneName[`${s}ThumbProximal`];
    return VRMHumanBoneName[`${s}ThumbDistal`];
  }

  const fingerMap = {
    index: "Index",
    middle: "Middle",
    ring: "Ring",
    little: "Little",
  };

  const f = fingerMap[finger];
  const seg =
    segment === "proximal"
      ? "Proximal"
      : segment === "intermediate"
      ? "Intermediate"
      : "Distal";

  return VRMHumanBoneName[`${s}${f}${seg}`];
}

function applyFingerChain(humanoid, side, fingerData) {
  if (!humanoid || !fingerData) return;

  {
    const node = humanoid.getNormalizedBoneNode(
      fingerBoneName(side, "thumb", "metacarpal")
    );
    applyBoneEuler(node, fingerData.thumb?.metacarpal, {
      xMin: -0.6,
      xMax: 0.6,
      yMin: -0.6,
      yMax: 0.6,
      zMin: -0.8,
      zMax: 0.8,
    });
  }
  {
    const node = humanoid.getNormalizedBoneNode(
      fingerBoneName(side, "thumb", "proximal")
    );
    applyBoneEuler(node, fingerData.thumb?.proximal, {
      xMin: -0.6,
      xMax: 0.6,
      yMin: -0.6,
      yMax: 0.6,
      zMin: -1.0,
      zMax: 1.0,
    });
  }
  {
    const node = humanoid.getNormalizedBoneNode(
      fingerBoneName(side, "thumb", "distal")
    );
    applyBoneEuler(node, fingerData.thumb?.distal, {
      xMin: -0.6,
      xMax: 0.6,
      yMin: -0.6,
      yMax: 0.6,
      zMin: -0.9,
      zMax: 0.9,
    });
  }

  for (const finger of ["index", "middle", "ring", "little"]) {
    for (const segment of ["proximal", "intermediate", "distal"]) {
      const node = humanoid.getNormalizedBoneNode(
        fingerBoneName(side, finger, segment)
      );

      applyBoneEuler(node, fingerData?.[finger]?.[segment], {
        xMin: -0.2,
        xMax: 0.2,
        yMin: -0.2,
        yMax: 0.2,
        zMin: -1.6,
        zMax: 1.6,
      });
    }
  }
}

export function applyAvatarStateToVrm(vrm, avatarState) {
  if (!vrm || !avatarState) return;

  const humanoid = vrm.humanoid;
  if (humanoid) {
    logFingerHumanoidCoverageOnce(vrm, humanoid);

    const headNode = humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head);

    const leftUpperArmNode = humanoid.getNormalizedBoneNode(
      VRMHumanBoneName.LeftUpperArm
    );
    const rightUpperArmNode = humanoid.getNormalizedBoneNode(
      VRMHumanBoneName.RightUpperArm
    );

    const leftLowerArmNode = humanoid.getNormalizedBoneNode(
      VRMHumanBoneName.LeftLowerArm
    );
    const rightLowerArmNode = humanoid.getNormalizedBoneNode(
      VRMHumanBoneName.RightLowerArm
    );

    const leftHandNode = humanoid.getNormalizedBoneNode(
      VRMHumanBoneName.LeftHand
    );
    const rightHandNode = humanoid.getNormalizedBoneNode(
      VRMHumanBoneName.RightHand
    );

    if (headNode) {
      headNode.rotation.x = degToRadClamped(
        avatarState.bones?.head?.x,
        -30,
        30
      );

      headNode.rotation.y = degToRadClamped(
        avatarState.bones?.head?.y,
        -45,
        45
      );

      headNode.rotation.z = degToRadClamped(
        avatarState.bones?.head?.z,
        -20,
        20
      );
    }

    applyBoneEuler(leftUpperArmNode, avatarState.bones?.leftUpperArm, {
      xMin: -2.2,
      xMax: 2.2,
      yMin: -2.2,
      yMax: 2.2,
      zMin: -2.2,
      zMax: 2.2,
    });

    applyBoneEuler(rightUpperArmNode, avatarState.bones?.rightUpperArm, {
      xMin: -2.2,
      xMax: 2.2,
      yMin: -2.2,
      yMax: 2.2,
      zMin: -2.2,
      zMax: 2.2,
    });

    applyBoneEuler(leftLowerArmNode, avatarState.bones?.leftLowerArm, {
      xMin: -2.2,
      xMax: 2.2,
      yMin: -2.2,
      yMax: 2.2,
      zMin: -2.2,
      zMax: 2.2,
    });

    applyBoneEuler(rightLowerArmNode, avatarState.bones?.rightLowerArm, {
      xMin: -2.2,
      xMax: 2.2,
      yMin: -2.2,
      yMax: 2.2,
      zMin: -2.2,
      zMax: 2.2,
    });

    applyBoneEuler(leftHandNode, avatarState.bones?.leftHand, {
      xMin: -1.0,
      xMax: 1.0,
      yMin: -0.8,
      yMax: 0.8,
      zMin: -1.2,
      zMax: 1.2,
    });

    applyBoneEuler(rightHandNode, avatarState.bones?.rightHand, {
      xMin: -1.0,
      xMax: 1.0,
      yMin: -0.8,
      yMax: 0.8,
      zMin: -1.2,
      zMax: 1.2,
    });

    applyFingerChain(humanoid, "left", avatarState.fingers?.left);
    applyFingerChain(humanoid, "right", avatarState.fingers?.right);
  }

  const expressionManager = vrm.expressionManager;
  if (expressionManager) {
    const blinkLeft = clamp(
      safe(avatarState.expressions?.blinkLeft, 0),
      0,
      1
    );
    const blinkRight = clamp(
      safe(avatarState.expressions?.blinkRight, 0),
      0,
      1
    );
    const mouthAa = clamp(
      safe(avatarState.expressions?.aa, 0),
      0,
      1
    );

    const hasBlinkLeft =
      expressionManager.getExpression(VRMExpressionPresetName.BlinkLeft) !== null;
    const hasBlinkRight =
      expressionManager.getExpression(VRMExpressionPresetName.BlinkRight) !== null;
    const hasBlink =
      expressionManager.getExpression(VRMExpressionPresetName.Blink) !== null;
    const hasAa =
      expressionManager.getExpression(VRMExpressionPresetName.Aa) !== null;

    if (hasBlinkLeft) {
      expressionManager.setValue(
        VRMExpressionPresetName.BlinkLeft,
        blinkLeft
      );
    }

    if (hasBlinkRight) {
      expressionManager.setValue(
        VRMExpressionPresetName.BlinkRight,
        blinkRight
      );
    }

    if (!hasBlinkLeft && !hasBlinkRight && hasBlink) {
      expressionManager.setValue(
        VRMExpressionPresetName.Blink,
        (blinkLeft + blinkRight) * 0.5
      );
    }

    if (hasAa) {
      expressionManager.setValue(VRMExpressionPresetName.Aa, mouthAa);
    }

    expressionManager.update();
  }
}
