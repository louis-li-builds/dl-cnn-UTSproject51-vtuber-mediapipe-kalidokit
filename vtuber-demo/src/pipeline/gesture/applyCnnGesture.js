/**
 * Attach stable CNN label to the tracked hand and set gesture_cnn_active for VRM pose override.
 */

function buildActiveLabel(label, confidence, config) {
  const override = config?.poseOverride ?? { enabled: true };
  const minConf = override.minConfidence ?? config?.minConfidence ?? 0.5;
  const allowed = override.gestures;

  if (
    override.enabled !== false &&
    label &&
    confidence >= minConf &&
    (!Array.isArray(allowed) || allowed.length === 0 || allowed.includes(label))
  ) {
    return label;
  }
  return null;
}

function resolveLabelAndConfidence(snap, config) {
  const override = config?.poseOverride ?? { enabled: true };
  const label =
    override.useStableLabel !== false
      ? snap.stableLabel ?? snap.label
      : snap.rawLabel ?? snap.label;
  const confidence = snap.stableConfidence ?? snap.confidence ?? 0;
  return { label, confidence };
}

function applySidePatch(handState, snap, config) {
  if (!handState) return;

  const { label, confidence } = resolveLabelAndConfidence(snap, config);
  const active = buildActiveLabel(label, confidence, config);

  handState.gesture_cnn = label;
  handState.gesture_cnn_raw = snap.rawLabel;
  handState.gesture_cnn_confidence = confidence;
  handState.gesture_cnn_active = active;
  handState.gesture_cnn_pose_locked = Boolean(active);
}

function clearSideGesture(handState) {
  if (!handState) return;
  handState.gesture_cnn = null;
  handState.gesture_cnn_raw = null;
  handState.gesture_cnn_confidence = null;
  handState.gesture_cnn_active = null;
  handState.gesture_cnn_pose_locked = false;
}

function applyLegacySingleHand(motionState, snap, config) {
  const { label, confidence } = resolveLabelAndConfidence(snap, config);
  const active = buildActiveLabel(label, confidence, config);

  const patch = {
    gesture_cnn: label,
    gesture_cnn_raw: snap.rawLabel,
    gesture_cnn_confidence: confidence,
    gesture_cnn_active: active,
    gesture_cnn_pose_locked: Boolean(active),
  };

  const side = snap.side;
  if (side === "left" && motionState.hands.left?.detected) {
    Object.assign(motionState.hands.left, patch);
    clearSideGesture(motionState.hands.right);
  } else if (side === "right" && motionState.hands.right?.detected) {
    Object.assign(motionState.hands.right, patch);
    clearSideGesture(motionState.hands.left);
  }
}

/**
 * @param {object} motionState
 * @param {object|null} snap from gestureClassifier.getSnapshot()
 * @param {object} config gesture-model.json
 */
export function applyCnnGestureToMotionState(motionState, snap, config) {
  if (!motionState?.hands || !snap) return;

  if (snap.dualHand && snap.bySide) {
    for (const side of ["left", "right"]) {
      const hand = motionState.hands[side];
      const sideSnap = snap.bySide[side];
      if (hand?.detected && sideSnap) {
        applySidePatch(hand, sideSnap, config);
      } else {
        clearSideGesture(hand);
      }
    }
    return;
  }

  applyLegacySingleHand(motionState, snap, config);
}
