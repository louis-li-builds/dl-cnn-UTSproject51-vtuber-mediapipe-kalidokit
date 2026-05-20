/**
 * Holistic + HandLandmarker fusion.
 *
 * 舊版曾用「畫面左右手腕 X」補洞（spatial），與 MediaPipe 解剖學 handedness 混用，
 * 在信心度跨門檻時會左右互換。此版全程以解剖學標籤為主，並對 hand index 做黏著。
 */

const T_HIGH = 0.45;
const T_LOW = 0.2;
/** 新候選需比舊 index 的同名信心高出此值才換手，降低單幀誤判抖動 */
const FLIP_MARGIN = 0.12;
/** 舊 index 仍可保留的最低 handedness 分數 */
const HOLD_MIN = 0.18;

const sticky = {
  leftIdx: -1,
  rightIdx: -1,
  /** 單手且無標籤時，手腕 x 的 EMA（0–1） */
  wristEma: null,
};

function buildHandBlock({
  landmarks = [],
  worldLandmarks = [],
  handednessScore = null,
  source = "none",
}) {
  return {
    detected: landmarks.length > 0,
    landmarks,
    worldLandmarks,
    count: landmarks.length,
    worldCount: worldLandmarks.length,
    handednessScore,
    source,
  };
}

function readHandedness(handResult, index) {
  const h = handResult?.handedness?.[index]?.[0];
  const category = h?.categoryName?.toLowerCase?.() ?? "";
  const score = Number.isFinite(h?.score) ? h.score : 0;
  return { category, score };
}

function wristX(handResult, index) {
  const lm = handResult?.landmarks?.[index]?.[0];
  return Number.isFinite(lm?.x) ? lm.x : 0.5;
}

function buildFromHandIndex(handResult, index, sourceTag) {
  if (!handResult?.landmarks?.[index]) {
    return null;
  }

  const { category, score } = readHandedness(handResult, index);

  return {
    landmarks: handResult.landmarks[index] ?? [],
    worldLandmarks: handResult.worldLandmarks?.[index] ?? [],
    handednessScore: Number.isFinite(score) ? score : null,
    source: sourceTag,
  };
}

/**
 * 在 indices 裡找 category===label 且 score>=minScore 的最高分 index（不含 exclude）
 */
function bestIndexForLabel(handResult, label, minScore, exclude = -1) {
  const n = handResult?.landmarks?.length ?? 0;
  let best = -1;
  let bestScore = -1;

  for (let i = 0; i < n; i += 1) {
    if (i === exclude) continue;
    const { category, score } = readHandedness(handResult, i);
    if (category !== label) continue;
    if (score < minScore) continue;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }

  return best >= 0 ? { index: best, score: bestScore } : null;
}

function scoreForLabelAt(handResult, index, label) {
  if (index < 0) return 0;
  const { category, score } = readHandedness(handResult, index);
  return category === label ? score : 0;
}

function stabilizeSlot(prevIndex, candidateIndex, handResult, label) {
  const n = handResult?.landmarks?.length ?? 0;

  if (candidateIndex < 0) {
    if (
      prevIndex >= 0 &&
      prevIndex < n &&
      (handResult.landmarks[prevIndex]?.length ?? 0) > 0 &&
      scoreForLabelAt(handResult, prevIndex, label) >= HOLD_MIN
    ) {
      return prevIndex;
    }
    return -1;
  }

  if (prevIndex < 0 || prevIndex >= n) {
    return candidateIndex;
  }

  if (prevIndex === candidateIndex) {
    return candidateIndex;
  }

  const prevScore = scoreForLabelAt(handResult, prevIndex, label);
  const candScore = scoreForLabelAt(handResult, candidateIndex, label);
  const prevHasLm = (handResult.landmarks[prevIndex]?.length ?? 0) > 0;

  if (
    prevHasLm &&
    prevScore >= HOLD_MIN &&
    candScore < prevScore + FLIP_MARGIN
  ) {
    return prevIndex;
  }

  return candidateIndex;
}

/**
 * 兩手：各取解剖學 left / right 最佳 index（先高門檻再低門檻），並避免同一隻手佔兩槽。
 */
function pairTwoHandsAnatomical(handResult) {
  let left = bestIndexForLabel(handResult, "left", T_HIGH);
  let right = bestIndexForLabel(handResult, "right", T_HIGH);

  if (!left) left = bestIndexForLabel(handResult, "left", T_LOW);
  if (!right) right = bestIndexForLabel(handResult, "right", T_LOW);

  let li = left?.index ?? -1;
  let ri = right?.index ?? -1;

  if (li >= 0 && ri >= 0 && li === ri) {
    const preferLeft = (left?.score ?? 0) >= (right?.score ?? 0);
    if (preferLeft) {
      const alt = bestIndexForLabel(handResult, "right", T_LOW, li);
      ri = alt?.index ?? -1;
    } else {
      const alt = bestIndexForLabel(handResult, "left", T_LOW, ri);
      li = alt?.index ?? -1;
    }
  }

  return { leftIdx: li, rightIdx: ri };
}

/**
 * 單手：優先用 handedness；無標籤時用手腕 x EMA 決定槽位（避免在 0.5 附近瘋狂切換）。
 */
function assignSingleHand(handResult) {
  const { category } = readHandedness(handResult, 0);
  const wx = wristX(handResult, 0);

  let slot;
  if (category === "left") {
    slot = "left";
    sticky.wristEma = null;
  } else if (category === "right") {
    slot = "right";
    sticky.wristEma = null;
  } else {
    const ema =
      sticky.wristEma === null ? wx : sticky.wristEma * 0.88 + wx * 0.12;
    sticky.wristEma = ema;
    slot = ema < 0.5 ? "left" : "right";
  }

  const pick = buildFromHandIndex(
    handResult,
    0,
    category ? "handLandmarker" : "handLandmarker_single_ema"
  );

  if (slot === "left") {
    return { left: pick, right: null };
  }

  return { left: null, right: pick };
}

function resolveDedicatedHands(handResult) {
  const n = handResult?.landmarks?.length ?? 0;

  if (n === 0) {
    sticky.leftIdx = -1;
    sticky.rightIdx = -1;
    return { left: null, right: null };
  }

  if (n === 1) {
    const single = assignSingleHand(handResult);
    const li = single.left ? 0 : -1;
    const ri = single.right ? 0 : -1;
    sticky.leftIdx = li;
    sticky.rightIdx = ri;
    return { left: single.left, right: single.right };
  }

  let { leftIdx, rightIdx } = pairTwoHandsAnatomical(handResult);

  leftIdx = stabilizeSlot(sticky.leftIdx, leftIdx, handResult, "left");
  rightIdx = stabilizeSlot(sticky.rightIdx, rightIdx, handResult, "right");

  if (leftIdx >= 0 && rightIdx >= 0 && leftIdx === rightIdx) {
    const lScore = scoreForLabelAt(handResult, leftIdx, "left");
    const rScore = scoreForLabelAt(handResult, rightIdx, "right");
    if (lScore >= rScore) {
      rightIdx = bestIndexForLabel(handResult, "right", T_LOW, leftIdx)?.index ?? -1;
    } else {
      leftIdx = bestIndexForLabel(handResult, "left", T_LOW, rightIdx)?.index ?? -1;
    }
  }

  sticky.leftIdx = leftIdx;
  sticky.rightIdx = rightIdx;

  const left =
    leftIdx >= 0
      ? buildFromHandIndex(handResult, leftIdx, "handLandmarker")
      : null;
  const right =
    rightIdx >= 0
      ? buildFromHandIndex(handResult, rightIdx, "handLandmarker")
      : null;

  return { left, right };
}

export function buildTrackingResult(
  rawResult,
  timestamp = performance.now(),
  options = {}
) {
  const holisticResult = rawResult?.holisticResult ?? rawResult ?? {};
  const handResult = rawResult?.handResult ?? null;

  const faceLandmarks = holisticResult.faceLandmarks?.[0] ?? [];
  const poseLandmarks = holisticResult.poseLandmarks?.[0] ?? [];
  const poseWorldLandmarks = holisticResult.poseWorldLandmarks?.[0] ?? [];

  const dedicated = resolveDedicatedHands(handResult);

  const fallbackLeft = {
    landmarks: holisticResult.leftHandLandmarks?.[0] ?? [],
    worldLandmarks: [],
    handednessScore: null,
    source: "holistic",
  };

  const fallbackRight = {
    landmarks: holisticResult.rightHandLandmarks?.[0] ?? [],
    worldLandmarks: [],
    handednessScore: null,
    source: "holistic",
  };

  let leftHand = dedicated.left ?? fallbackLeft;
  let rightHand = dedicated.right ?? fallbackRight;

  if (options.swapHandsForAvatar) {
    const tmp = leftHand;
    leftHand = rightHand;
    rightHand = tmp;
  }

  return {
    timestamp,

    face: {
      detected: faceLandmarks.length > 0,
      landmarks: faceLandmarks,
      count: faceLandmarks.length,
    },

    pose: {
      detected: poseLandmarks.length > 0,
      landmarks: poseLandmarks,
      worldLandmarks: poseWorldLandmarks,
      count: poseLandmarks.length,
      worldCount: poseWorldLandmarks.length,
    },

    hands: {
      left: buildHandBlock(leftHand),
      right: buildHandBlock(rightHand),
    },
  };
}
