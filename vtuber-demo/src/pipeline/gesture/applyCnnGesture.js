/**
 * Attach stable CNN label to the tracked hand and set gesture_cnn_active for VRM pose override.
 */
export function applyCnnGestureToMotionState(motionState, snap, config) {
  if (!motionState?.hands || !snap) return;

  const override = config?.poseOverride ?? { enabled: true };
  const minConf = override.minConfidence ?? config?.minConfidence ?? 0.5;
  const label =
    override.useStableLabel !== false
      ? snap.stableLabel ?? snap.label
      : snap.rawLabel ?? snap.label;
  const confidence = snap.stableConfidence ?? snap.confidence ?? 0;

  const allowed = override.gestures;
  let active = null;

  if (
    override.enabled !== false &&
    label &&
    confidence >= minConf &&
    (!Array.isArray(allowed) || allowed.length === 0 || allowed.includes(label))
  ) {
    active = label;
  }

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
    if (motionState.hands.right) {
      motionState.hands.right.gesture_cnn_active = null;
      motionState.hands.right.gesture_cnn_pose_locked = false;
    }
  } else if (side === "right" && motionState.hands.right?.detected) {
    Object.assign(motionState.hands.right, patch);
    if (motionState.hands.left) {
      motionState.hands.left.gesture_cnn_active = null;
      motionState.hands.left.gesture_cnn_pose_locked = false;
    }
  }
}
