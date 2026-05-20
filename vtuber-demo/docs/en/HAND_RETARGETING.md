# Hand retargeting (VRM vs webcam landmarks)

If the **webcam overlay** matches your hands but the **3D avatar** does not, the issue is usually VRM bone mapping—not the CNN gesture classifier.

## What we use

1. **[Kalidokit](https://github.com/yeemachine/kalidokit) `Hand.solve`** — per-finger joint angles from 21 MediaPipe landmarks (same family as Kalidoface).
2. **Holistic `leftHandWorldLandmarks` / `rightHandWorldLandmarks`** — palm normal for wrist pitch/yaw (see [MediaPipe holistic z-axis note](https://github.com/google/mediapipe/issues/3810)).
3. **Per-bone VRM finger chain** — thumb metacarpal + proximal/distal; index–little proximal/intermediate/distal (ported from teammate skeleton demo).

## Tuning

| File | Knob |
|------|------|
| `src/tracking/trackingResult.js` | `TRACKING_SWAP_HAND_SIDES` — set `true` if left/right are swapped on the avatar only |
| `src/avatar/vrmMapper.js` | `LOWER_ARM_*` scales — forearm follow vs stability |
| `src/motion/handPose.js` | `calibrateWrist()` gains — wrist orientation strength |

## CNN pose override (same idea as teammate RPS demo)

When Exp02 reports a **stable** class above `poseOverride.minConfidence`, the avatar uses a **fixed finger pose** from `src/avatar/gestureFingerPoses.js` and **locks the wrist** (no landmark wrist spin). This matches how the skeleton demo maps `activeGesture` → `makeRpsFixedFingerPose` for rock / paper / scissors.

Configure in `assets/models/gesture/gesture-model.json`:

```json
"poseOverride": {
  "enabled": true,
  "minConfidence": 0.5,
  "stableFrames": 3,
  "gestures": ["fist", "palm", "peace", ...]
}
```

- **`gesture_cnn`** — label shown in the motion panel.
- **`gesture_cnn_active`** — when set, VRM fingers use the fixed pose (less jitter).
- **Non-classified hand** — still uses landmark / Kalidokit path.

Teammate difference: they use a **3-class RPS** model and `await classifyFrame()` in the frame loop (can stall). We use **12-class Exp02** on a throttled non-blocking path.
