# Set A gesture CNN (Exp02) — browser integration

The live demo loads **Exp02 (VGGStyleCNN)** exported to ONNX. Holistic tracking and VRM rendering stay on the main frame loop (~30 FPS). Gesture classification runs on a **throttled side path** (default ~10 inferences per second; see `gesture-model.json`) so the UI stays responsive. Hand crops use **fused HandLandmarker + Holistic** landmarks when the dedicated model loads (tighter bbox than Holistic-only hands). ONNX Runtime tries **WebGPU** first, then falls back to **WASM**.

## Bundled model

The public repo ships **`hagrid_exp02_vgg_inline.onnx`** (~14 MB, weights embedded) under `vtuber-demo/assets/models/gesture/`. Re-export from your own training weights (e.g. `best_weights.pt`) is a **local/offline** step—not part of this repository.

A split `hagrid_exp02_vgg.onnx` + `.onnx.data` export may exist from some toolchains; **browser ORT cannot load the split** (`MountedFiles is not available`) — use the `_inline` artifact in the demo folder.

Defaults match Set A: 224×224 input, ImageNet normalization, 12 HaGRID classes.

## Preprocessing (live crop)

`handCrop.js` uses an axis-aligned bbox with separate X/Y margin, then **square letterboxing** (black padding) before resize—same idea as the teammate skeleton demo’s crop helper. The CNN path stays **non-blocking** (no `await` inside Holistic `onFrame`). Skeleton-only tweaks such as `estimateWristRotation` affect VRM arm pose, not the 12-class classifier.

## Run the demo

```bash
cd vtuber-demo
npm install
npm start
```

Open the URL shown (typically `http://localhost:3000`), allow camera access. The motion panel shows:

- `gesture_basic` — rule-based labels from landmarks  
- `gesture_cnn` / `gesture_cnn_conf` — Exp02 ONNX (when the model file is present)

If the ONNX file is missing, the app still runs with Holistic retargeting and rule-based gestures only.

## Tuning real-time behaviour

Edit `assets/models/gesture/gesture-model.json`:

| Field | Typical range | Effect |
|-------|----------------|--------|
| `inferenceIntervalMs` | 80–150 | CNN rate (lower = more load; needs WebGPU or fast WASM) |
| `stableFrames` | 1–3 | Reduces label flicker (higher = slower label commits) |
| `minConfidence` | 0.4–0.6 | Ignores weak predictions |
| `poseOverride.useStableLabel` | `true` / `false` | `false` = react to raw CNN label (faster; raise `minConfidence` to tame flicker) |
| `cropMargin` | 0.08 (match training PAD) | Hand crop size |
| `preferHand` | `"right"` or `"left"` | Classify one hand only |
