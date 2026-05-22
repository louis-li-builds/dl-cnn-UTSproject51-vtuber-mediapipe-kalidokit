# Demo runtime configuration (`demo-config.json`)

With **Vite**, copy or edit `public/demo-config.json` (served as `/demo-config.json`). If the file is missing, built-in defaults apply.

## `tracking.swapHandSides`

If **true**, each hand’s landmark stream is **crossed** into the opposite slot: MediaPipe handedness **Left** is stored under `trackingResult.hands.right` (so the **avatar’s right arm** follows your physical left hand). Default is **false** so **physical left → avatar left** when `mirrorInference` is on.

If you still see the wrong arm, toggle this boolean (or try `mirrorInference`) and reload; setups differ by camera CSS mirror vs model facing.

## `tracking.invertMirroredHandedness`

When **true** (default) **and** `mirrorInference` is on, HandLandmarker **Left/Right** labels are **flipped once** before slotting **only one** detected hand (Holistic XOR / no hands). **Two-hand handedness-only** pairing does **not** apply this flip (both labels stay as reported). Set **false** if single-hand L/R is still inverted relative to your avatar.

## `tracking.mirrorInference`

When **true** (default), Holistic receives a **horizontally flipped** video frame so landmark handedness matches the **CSS-mirrored** webcam preview. Set **false** only if you disable the mirror preview or for debugging.

> **Note:** Swapping Kalidokit **Pose** left/right arm outputs to match hand slots was tried and **reverted** — on common rigs it can invert perceived lift direction (e.g. arm up → avatar down). Arm vs. hand **side** alignment may still need tuning via `swapHandSides` / `invertMirroredHandedness` rather than Pose channel swaps.

## Dedicated HandLandmarker (automatic)

Each frame, the pipeline runs **HandLandmarker** on the same `detectSource` as Holistic (see `src/pipeline/tracking/holistic.js`). `trackingResult.js` prefers dedicated **2D + world** hand landmarks when present (better gesture crops and fingers). If the model fails to load (network / WebGPU stack), the app falls back to Holistic hands only.

**Left/right slots:** With **both** Holistic hands present, dedicated hands are matched by **wrist distance** (singleton uses a **5-frame streak** stabilizer). When **only one** Holistic channel has data, use **mirrored handedness** (`invertMirroredHandedness`, default on) plus the same stabilizer. With **one dedicated hand**, the empty side does **not** show a Holistic ghost hand (avoids yellow/pink dots swapping). Landmarks are **held ~280 ms** after brief dropout. Then `tracking.swapHandSides` may swap the two slots.

### System log panel

Logs are **append-only** (max 64 lines) with tags: `[boot]`, `[cam]`, `[vrm]`, `[gesture]`, `[track]`, `[holistic]`. Switching avatars adds `[vrm]` lines without wiping earlier boot messages. `[track]` updates about every **1.5 s** with hand slot `source` — useful to see ghost-hand flicker (`holistic` vs `handLandmarker` alternating on one side).

### Flickering (single hand)

If the **webcam overlay** or **avatar hands** still flash:

1. Keep `invertMirroredHandedness: true` and `swapHandSides: false` first; toggle only one at a time.
2. Motion panel `source:` should stay on one side (e.g. `singleton→left`, not alternating).
3. Lower `smoothing.oneEuro.minCutoff` slightly (e.g. `0.8`) for steadier fingers — trades a bit of lag.
4. Avoid extreme `digitalZoom` / poor lighting (MediaPipe handedness jitters more).

## `webcam`

| Field | Meaning |
|-------|---------|
| `videoProfile` | `"standard"`, `"wide"`, or `"compact"` — `getUserMedia` hints. |
| `objectFit` | Passed to the `<video>` element. |
| `digitalZoom` | Slight zoom inside the mirrored frame (0.72–1). |

## `scene` (three.js framing)

Tweak how much of the VRM fits in the panel (defaults pull the camera back and widen FOV so **hands** stay visible).

| Field | Meaning |
|-------|---------|
| `cameraFov` | Perspective vertical field of view (degrees). Higher = wider view. |
| `cameraDistance` | Camera Z distance from origin. Larger = smaller character on screen. |
| `cameraHeight` | Camera Y position. |
| `lookAtY` | Where the camera looks (upper body / chest height). |
| `avatarScale` | Uniform scale on the loaded VRM root (`0`–`1` typical). Lower = smaller model. |

## `holistic.detectMaxWidth`

When **greater than zero**, Holistic runs on an offscreen canvas scaled to that maximum width (same aspect ratio as the webcam). This mirrors the “use a smaller capture size for speed/stability” idea used in commercial webcam mocap apps.

- `0` — run the model on the full-resolution video (higher CPU/GPU load).

## `smoothing`

| Field | Meaning |
|-------|---------|
| `mode` | `"oneEuro"` (default) or `"lerp"` |
| `alpha` | Used only for `lerp` (0–1). |
| `oneEuro.minCutoff` | Minimum cutoff frequency (Hz). Higher = less smoothing when still. |
| `oneEuro.beta` | Speed of cutoff increase with motion; higher = less lag when moving. |
| `oneEuro.dCutoff` | Cutoff for derivative filter. |

One Euro reference: [1€ filter](https://cristal.univ-lille.fr/~casiez/1euro/).

## `forward` (optional JSON/WebSocket export)

Lightweight **JSON** stream of `avatarState` (bones, fingers, lookAt, expressions) for custom receivers—not full VMC binary.

| Field | Meaning |
|-------|---------|
| `enabled` | `true` to open a WebSocket client. |
| `url` | e.g. `ws://127.0.0.1:8765` |
| `intervalMs` | Minimum time between sends (default 33 ≈ 30 Hz). |
| `reconnectMs` | Delay before reconnect after disconnect. |

**Quick test receiver** (Node): `npx --yes wscat -l 8765` then set `"enabled": true`.

Payload shape:

```json
{
  "type": "vtuber-demo-avatar",
  "v": 1,
  "t": 12345.6,
  "state": { "bones": {}, "fingers": {}, "lookAt": {}, "expressions": {} }
}
```
