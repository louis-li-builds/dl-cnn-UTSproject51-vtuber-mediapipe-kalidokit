/**
 * Short hold of last good per-slot hand landmarks when detection drops for a few frames.
 * Reduces overlay / VRM flicker from MediaPipe dropout.
 */

/** Legacy main: longer hold. Exp02 path uses shorter hold via `applyHandLandmarkHold`. */
const DEFAULT_HOLD_MS = 380;
const EXP02_HOLD_MS = 0;

const hold = {
  left: null,
  right: null,
  leftAt: 0,
  rightAt: 0,
};

function emptyPick() {
  return {
    landmarks: [],
    worldLandmarks: [],
    handednessScore: null,
    handednessLabel: null,
    source: "none",
  };
}

function clonePick(pick) {
  return {
    landmarks: [...(pick.landmarks ?? [])],
    worldLandmarks: [...(pick.worldLandmarks ?? [])],
    handednessScore: pick.handednessScore,
    handednessLabel: pick.handednessLabel,
    source: pick.source,
  };
}

export function resetHandLandmarkHold() {
  hold.left = null;
  hold.right = null;
  hold.leftAt = 0;
  hold.rightAt = 0;
}

/**
 * @param {"left"|"right"} side
 * @param {object} pick candidate block before buildHandBlock
 * @param {number} nowMs
 */
function stabilizeSide(side, pick, nowMs, holdMs) {
  const hasLm = (pick.landmarks?.length ?? 0) > 0;

  if (hasLm) {
    const stored = clonePick(pick);
    if (side === "left") {
      hold.left = stored;
      hold.leftAt = nowMs;
    } else {
      hold.right = stored;
      hold.rightAt = nowMs;
    }
    return pick;
  }

  const prev = side === "left" ? hold.left : hold.right;
  const prevAt = side === "left" ? hold.leftAt : hold.rightAt;

  if (holdMs > 0 && prev && nowMs - prevAt < holdMs) {
    return {
      ...clonePick(prev),
      source: `${prev.source}+hold`,
    };
  }

  return pick;
}

/**
 * @param {object} pickLeft
 * @param {object} pickRight
 * @param {number} timestampMs
 */
export function applyHandLandmarkHold(pickLeft, pickRight, timestampMs, options = {}) {
  const nowMs = timestampMs ?? performance.now();
  const holdMs =
    typeof options.holdMs === "number"
      ? options.holdMs
      : options.handSlotMode === "exp02"
        ? EXP02_HOLD_MS
        : DEFAULT_HOLD_MS;
  return {
    left: stabilizeSide("left", pickLeft, nowMs, holdMs),
    right: stabilizeSide("right", pickRight, nowMs, holdMs),
  };
}

export { emptyPick };
