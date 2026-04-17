import * as THREE from "three";
import {
  VRMExpressionPresetName,
  VRMHumanBoneName,
} from "@pixiv/three-vrm";

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

function getHumanoidBone(humanoid, boneKey, fallbackName) {
  if (!humanoid) return null;
  const name = VRMHumanBoneName?.[boneKey] ?? fallbackName;
  if (!name) return null;
  return humanoid.getNormalizedBoneNode(name) ?? null;
}

function applyFingerCurlToVrm(humanoid, avatarState) {
  if (!humanoid) return;

  const fingers = avatarState?.fingers ?? {};

  const fingerDefs = [
    { key: "thumb", bone: "Thumb", max: { p: 55, i: 35, d: 25 } },
    { key: "index", bone: "Index", max: { p: 70, i: 85, d: 60 } },
    { key: "middle", bone: "Middle", max: { p: 70, i: 85, d: 60 } },
    { key: "ring", bone: "Ring", max: { p: 70, i: 85, d: 60 } },
    { key: "pinky", bone: "Little", max: { p: 70, i: 85, d: 60 } },
  ];

  const segmentWeight = { p: 0.45, i: 0.35, d: 0.2 };
  const axisPriority = ["x", "z", "y"];
  const axisSign = {
    x: 1,
    y: 1,
    z: 1,
  };

  function applyBend(node, degrees, weight) {
    if (!node) return;
    const rad = THREE.MathUtils.degToRad(degrees * weight);
    for (const axis of axisPriority) {
      node.rotation.x = 0;
      node.rotation.y = 0;
      node.rotation.z = 0;
      node.rotation[axis] = rad * axisSign[axis];
      break;
    }
  }

  function applySide(sideKey, sidePrefix) {
    const side = fingers?.[sideKey] ?? {};

    for (const def of fingerDefs) {
      const curl01 = clamp(safe(side?.[def.key], 0), 0, 1);

      const prox = getHumanoidBone(
        humanoid,
        `${sidePrefix}${def.bone}Proximal`,
        `${sideKey}${def.bone}Proximal`
      );
      const inter = getHumanoidBone(
        humanoid,
        `${sidePrefix}${def.bone}Intermediate`,
        `${sideKey}${def.bone}Intermediate`
      );
      const dist = getHumanoidBone(
        humanoid,
        `${sidePrefix}${def.bone}Distal`,
        `${sideKey}${def.bone}Distal`
      );

      if (prox) applyBend(prox, def.max.p * curl01, segmentWeight.p);
      if (inter) applyBend(inter, def.max.i * curl01, segmentWeight.i);
      if (dist) applyBend(dist, def.max.d * curl01, segmentWeight.d);
    }
  }

  applySide("left", "Left");
  applySide("right", "Right");
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

export function applyAvatarStateToVrm(vrm, avatarState) {
  if (!vrm || !avatarState) return;

  const humanoid = vrm.humanoid;
  if (humanoid) {
    const headNode = getHumanoidBone(humanoid, "Head", "head");

    const leftUpperArmNode = getHumanoidBone(
      humanoid,
      "LeftUpperArm",
      "leftUpperArm"
    );
    const rightUpperArmNode = getHumanoidBone(
      humanoid,
      "RightUpperArm",
      "rightUpperArm"
    );

    const leftLowerArmNode = getHumanoidBone(
      humanoid,
      "LeftLowerArm",
      "leftLowerArm"
    );
    const rightLowerArmNode = getHumanoidBone(
      humanoid,
      "RightLowerArm",
      "rightLowerArm"
    );

    const leftHandNode = getHumanoidBone(humanoid, "LeftHand", "leftHand");
    const rightHandNode = getHumanoidBone(humanoid, "RightHand", "rightHand");

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
      xMin: -1.6,
      xMax: 1.6,
      yMin: -1.6,
      yMax: 1.6,
      zMin: -1.6,
      zMax: 1.6,
    });

    applyBoneEuler(rightHandNode, avatarState.bones?.rightHand, {
      xMin: -1.6,
      xMax: 1.6,
      yMin: -1.6,
      yMax: 1.6,
      zMin: -1.6,
      zMax: 1.6,
    });

    applyFingerCurlToVrm(humanoid, avatarState);
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