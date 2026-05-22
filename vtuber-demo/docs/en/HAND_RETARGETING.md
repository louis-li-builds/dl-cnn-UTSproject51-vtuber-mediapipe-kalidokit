# Hand retargeting (VRM vs webcam landmarks)

If the **webcam overlay** matches your hands but the **3D avatar** does not, the issue is usually VRM bone mapping—not the CNN gesture classifier.

## What we use

1. **[Kalidokit](https://github.com/yeemachine/kalidokit) `Hand.solve`** — per-finger joint angles from 21 MediaPipe landmarks (same family as Kalidoface).
2. **Holistic `leftHandWorldLandmarks` / `rightHandWorldLandmarks`** — when the dedicated **HandLandmarker** fused in `holistic.js` is active, these slots prefer **HandLandmarker world landmarks**; otherwise Holistic world data is used for palm normal / wrist (see [MediaPipe holistic z-axis note](https://github.com/google/mediapipe/issues/3810)).
3. **Per-bone VRM finger chain** — thumb metacarpal + proximal/distal; index–little proximal/intermediate/distal (ported from teammate skeleton demo).
4. **Elbow angle for lower arm (fallback)** — when that **side’s hand** is tracked, elbow flex uses **shoulder–elbow–hand wrist (landmark 0)** instead of the **pose** wrist (15/16), so forearm bend stays plausible when the pose wrist is occluded or stuck (e.g. hand at the face).

## Tuning

| File | Knob |
|------|------|
| `demo-config.json` → `tracking.swapHandSides` | Applied **after** wrist-based matching: **`true`** swaps the final `hands.left` / `hands.right` blocks. Use if your rig still mirrors the wrong arm. Skeleton used a fixed equivalent of `true`; we default `false` and rely on Holistic wrist anchors first. |
| `src/pipeline/avatar/vrmMapper.js` | `LOWER_ARM_*` scales — forearm follow vs stability |
| `src/pipeline/motion/handPose.js` | `calibrateWrist()` gains — wrist orientation strength |

## CNN pose override (same idea as teammate RPS demo)

When Exp02 reports a class above `poseOverride.minConfidence`, the avatar uses a **fixed finger pose** from `gestureFingerPoses.js` and **locks the wrist** (no landmark wrist spin). With `poseOverride.useStableLabel: false`, the label reacts faster to the raw CNN output (tune confidence to reduce flicker).

Configure in `assets/models/gesture/gesture-model.json`:

```json
"poseOverride": {
  "enabled": true,
  "useStableLabel": false,
  "minConfidence": 0.58,
  "gestures": ["fist", "palm", "peace", ...]
}
```

- **`gesture_cnn`** — label shown in the motion panel.
- **`gesture_cnn_active`** — when set, VRM fingers use the fixed pose (less jitter).
- **Non-classified hand** — still uses landmark / Kalidokit path.

Teammate difference: they use a **3-class RPS** model and `await classifyFrame()` in the frame loop (can stall). We use **12-class Exp02** on a throttled non-blocking path.
