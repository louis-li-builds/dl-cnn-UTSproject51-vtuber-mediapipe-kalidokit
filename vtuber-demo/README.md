## VTuber Motion Capture Demo

[Project overview](../README.md) · [Documentation hub](../docs/README.md)

Browser demo: **MediaPipe Holistic** → **Kalidokit** → **three.js + VRM**, with optional **gesture ONNX** and **WebSocket JSON** export. The UI shell comes from **`origin/feature/figma-ui-integrated`** (Vite + React + Tailwind); the motion pipeline lives under **`src/pipeline/`**.

Runtime tuning: `public/demo-config.json` (served as `/demo-config.json`) — see [DEMO_CONFIG.md](docs/en/DEMO_CONFIG.md). Gesture notes: [GESTURE_CNN.md](docs/en/GESTURE_CNN.md).

---

## Tech Stack

- **Vite 6 + React 18 + TypeScript** — Figma-based layout (`src/app/`)
- **three.js + @pixiv/three-vrm** — VRM rendering (`src/pipeline/render/`)
- **MediaPipe Tasks Vision** — Holistic (CDN WASM)
- **Kalidokit** — face / pose / hand solving
- **onnxruntime-web** (CDN) — hand gesture CNN (optional)

---

## Project Structure (high level)

```text
vtuber-demo/
├─ index.html                 # Vite entry (root div)
├─ public/
│  ├─ demo-config.json        # Runtime tuning (mirrored in repo root demo-config.json)
│  └─ assets -> ../assets     # Symlink: VRM + gesture ONNX
├─ src/
│  ├─ main.tsx                # React bootstrap
│  ├─ app/                    # Figma UI shell
│  └─ pipeline/               # Tracking, motion, gesture, VRM (course pipeline)
│     ├─ boot.js             # Wires webcam → Holistic → motion → VRM + gesture
│     ├─ tracking/
│     ├─ motion/
│     ├─ gesture/
│     ├─ forward/
│     ├─ avatar/
│     └─ render/
└─ assets/models/             # VRM + gesture assets (also linked from public/)
```

---

## High-Level Pipeline

### Boot (`src/pipeline/boot.js`)

- Loads `/demo-config.json`, opens webcam, starts three.js scene, loads VRM from avatar catalog, initializes gesture ONNX when assets are present, starts Holistic with **mirrored inference** by default (see config).
- Each frame: gesture schedule → `buildMotionState` → smoother → CNN gesture overlay → `mapMotionStateToAvatarState` → `applyAvatarStateToVrm` → optional WebSocket forward.

(Detailed per-module behaviour is unchanged from the vanilla layout; only paths moved under `src/pipeline/`.)

---

## How to Run

From the `vtuber-demo` directory:

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`), allow the camera, pick an avatar in the shell UI.

**Production build:** `npm run build` then `npm run preview`.

---

## Key Design Ideas

- **Modular / Layered Design**
  - `src/pipeline/tracking/*`: MediaPipe + overlays → `trackingResult`
  - `src/pipeline/motion/*`: motion solving + smoothing
  - `src/pipeline/gesture/*`: optional ONNX gesture path
  - `src/pipeline/avatar/*`: motion → VRM bones / expressions
  - `src/pipeline/render/*`: three.js scene loop

- **Clear Units**
  - Most face angles are in **degrees** (Kalidokit Face)
  - Arm bone rotations are in **radians** (Kalidokit Pose)
  - The VRM driver converts degrees → radians where needed and clamps ranges

- **Extensibility**
  - `motionState` / `avatarState` are designed to be extensible:
    - Additional expressions (ih / ou / ee / oh) can be added
    - More bones (e.g., legs) can be supported
    - Finger bones can be driven more fully for richer hand gestures

