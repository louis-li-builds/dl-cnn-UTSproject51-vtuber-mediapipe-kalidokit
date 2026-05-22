# demo/skeleton-ui-exp02-onnx

**Figma React UI** + **skeleton tracking** (Holistic + HandLandmarker) + **your Exp02 ONNX only** — no teammate RPS on this branch.

## Run

```bash
cd vtuber-repo/vtuber-demo
git checkout demo/skeleton-ui-exp02-onnx
npm install
npm run dev
```

Use `npm run dev` (Vite), not `npx serve`. Open `http://localhost:5173`, hard refresh (Ctrl+Shift+R).

## UI vs teammate skeleton HTML

| | Teammate skeleton | This branch |
|---|-------------------|-------------|
| Stack | `serve` + vanilla JS | Vite + React |
| CPU | Slightly lighter bundle | Heavier UI, tracking cost is similar |
| Practical | Fine for demo | Figma layout + logs; perf difference is usually small vs MediaPipe |

Tracking runs on the main thread; ONNX uses `schedule()` and does not block the avatar.

## Finger poses

1. **Exp02 CNN** per hand (`gesture_cnn_active`)
2. **Landmark curl** fallback

Tune `assets/models/gesture/gesture-model.json` (`minConfidence`, `stableFrames`, `inferenceIntervalMs`, `useStableLabel`).

## Swap ONNX weights

1. Export from `experiments/model-2/best_weights.pt` (match `imgSize` 224 + ImageNet normalize).
2. Replace `assets/models/gesture/hagrid_exp02_vgg_inline.onnx`.
3. Align `classNames` with `experiments/model-2/class_map.json`.

## Branches on GitHub

| Branch | Purpose |
|--------|---------|
| [demo/freeze-6h](https://github.com/louis-li-builds/dl-cnn-UTSproject51-vtuber-mediapipe-kalidokit/tree/demo/freeze-6h) | Stable + optional teammate RPS |
| [demo/skeleton-ui-exp02-onnx](https://github.com/louis-li-builds/dl-cnn-UTSproject51-vtuber-mediapipe-kalidokit/tree/demo/skeleton-ui-exp02-onnx) | Your 12-class ONNX only |
