# demo/freeze-6h — Figma UI + teammate skeleton pipeline

## User flow

1. Open page → allow camera  
2. Load VRM (left sidebar)  
3. Bottom **terminal log** + right **motion parameters**  
4. Move in front of webcam → Holistic + HandLandmarker overlay + avatar follows  
5. Optional: HAGRID gesture (`gesture.enabled: true`)  
6. Optional: JSON export (`forward.enabled: true`)

## Run

```bash
cd vtuber-repo/vtuber-demo
git checkout demo/freeze-6h
npm install
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`). **Use one browser tab only.**

## Latency (what we fixed)

| Source | Teammate skeleton (old) | This branch |
|--------|-------------------------|-------------|
| RPS ONNX | `await classifyFrame()` every Holistic frame — blocks avatar | `schedule()` + cached result; avatar never waits |
| Holistic `onFrame` | `onFrameBusy` drops frames while ONNX runs | Sync `onFrame` every new video frame |
| HandLandmarker | Every 100 ms (unchanged) | Same |
| Holistic input | Full resolution | Optional downscale (`detectMaxWidth: 640`) |

If it still feels heavy: set `rps.minIntervalMs` to `800` or `rps.enabled: false` in `demo-config.json`.

## If camera fails (NotReadableError)

1. Close Teams / Zoom / other tabs using the camera  
2. Ctrl+C → `npm run dev` again  
3. Hard refresh the page (Ctrl+Shift+R)

## If left/right hand is wrong

Default is `swapHandSides: true` (teammate skeleton). Toggle **only** that flag in `public/demo-config.json`, reload.

## Disable RPS CNN

```json
"rps": { "enabled": false }
```

## Enable HAGRID CNN (optional, extra load)

```json
"gesture": { "enabled": true }
```

## Enable WebSocket export (optional)

```json
"forward": { "enabled": true, "url": "ws://127.0.0.1:8765" }
```

## Assets

- RPS model: `assets/models/rps_custom_cnn_v2_crop.onnx` (from teammate skeleton)
- VRM: `assets/models/*.vrm`
