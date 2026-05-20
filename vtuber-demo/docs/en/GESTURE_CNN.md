# Set A gesture CNN (Exp02) — browser integration

The live demo loads **Exp02 (VGGStyleCNN)** exported to ONNX. Holistic tracking and VRM rendering stay on the main frame loop (~30 FPS). Gesture classification runs on a **throttled side path** (~5 inferences per second) so the UI remains responsive.

## Export ONNX from training weights

From the project training environment, export **Set A Exp02** weights (e.g. `best_weights.pt` from training) into the demo assets folder:

```bash
python scripts/export_hagrid_onnx.py \
  --weights path/to/best_weights.pt \
  --output vtuber-demo/assets/models/gesture/hagrid_exp02_vgg.onnx
```

A pre-exported `hagrid_exp02_vgg.onnx` may already be present in the repository for team demos (~50 KB).

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
| `inferenceIntervalMs` | 150–250 | CNN rate (lower = more load) |
| `stableFrames` | 2–4 | Reduces label flicker |
| `minConfidence` | 0.4–0.6 | Ignores weak predictions |
| `cropMargin` | 0.08 (match training PAD) | Hand crop size |
| `preferHand` | `"right"` or `"left"` | Classify one hand only |
