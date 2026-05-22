/**
 * Apply per-hand CNN labels to motionState for VRM finger pose override.
 */

function buildActiveLabel(snap, config) {
  const override = config?.poseOverride ?? { enabled: true };
  const minConf = override.minConfidence ?? config?.minConfidence ?? 0.4;
  const useStable = override.useStableLabel !== false;
  const label = useStable
    ? snap.stableLabel ?? snap.label
    : snap.rawLabel ?? snap.label;
  const confidence = snap.stableConfidence ?? snap.confidence ?? 0;
  const allowed = override.gestures;

  if (
    override.enabled === false ||
    !label ||
    confidence < minConf ||
    (Array.isArray(allowed) &&
      allowed.length > 0 &&
      !allowed.includes(label))
  ) {
    return { label, confidence, active: null };
  }

  return { label, confidence, active: label };
}

function applyToHand(handState, snap, config) {
  if (!handState?.detected || !snap) return;

  const { label, confidence, active } = buildActiveLabel(snap, config);

  Object.assign(handState, {
    gesture_cnn: label,
    gesture_cnn_raw: snap.rawLabel,
    gesture_cnn_confidence: confidence,
    gesture_cnn_active: active,
    gesture_cnn_pose_locked: Boolean(active),
  });
}

export function applyCnnGestureToMotionState(motionState, snap, config) {
  if (!motionState?.hands || !snap?.enabled) return;

  applyToHand(motionState.hands.left, snap.left, config);
  applyToHand(motionState.hands.right, snap.right, config);
}
