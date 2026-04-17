# DL/CNN VTuber Demo — English guide

[Overview (root)](../../README.md) · **English (full guide)** · [繁體中文](../zh-TW/README.md) · [Docs hub](../README.md)

[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=000)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

Browser **VTuber-style motion capture** for a **Deep Learning / CNN** course: **MediaPipe Holistic** → **Kalidokit** → **three.js + @pixiv/three-vrm** on a **VRM** model.

**Status:** Webcam + landmark overlay, motion readouts, VRM retargeting (head, arms, hands, expressions, finger curl). **three.js / three-vrm** load from a **CDN import map**; **Kalidokit** is bundled via **npm** (ESM). Use **localhost** (or HTTPS) and grant **camera** permission.

---

## Repository layout

| Path | Role |
|------|------|
| `vtuber-demo/` | Runnable static app: `index.html`, `src/`, `assets/models/avatar.vrm` |
| `vtuber-demo/src/tracking/` | Webcam, MediaPipe Holistic, `trackingResult` normalization |
| `vtuber-demo/src/motion/` | Kalidokit + geometry → `motionState`, EMA smoother |
| `vtuber-demo/src/avatar/` | VRM load, `motionState` → `avatarState`, bone / expression apply |
| `vtuber-demo/src/render/` | three.js scene, render loop |
| `docs/` | This documentation hub |

The repo root holds optional npm metadata; **always run the demo from `vtuber-demo/`**.

---

## Prerequisites

- **Node.js 18+** (for `npm` and `npx serve`)
- A **webcam** and a browser with **getUserMedia** support

---

## Quick start

```bash
git clone https://github.com/LouisLi1020/dl-cnn-UTSproject52-vtuber-mediapipe-kalidokit.git
cd dl-cnn-UTSproject52-vtuber-mediapipe-kalidokit/vtuber-demo
npm install
npm start
```

Open the printed URL (often **http://localhost:3000**), allow webcam access.

---

## Scripts (`vtuber-demo/`)

| Command | Purpose |
|--------|---------|
| `npm install` | Installs `kalidokit` (and lockfile consistency) |
| `npm start` | `npx serve .` — static host for ES modules + import map |

---

## Pipeline (short)

1. **Boot** (`src/main.js`): webcam → three.js scene → load VRM → Holistic tracker.
2. Each frame: `buildTrackingResult` → `buildMotionState` (Face / Pose / hands) → smoother → `mapMotionStateToAvatarState` → `applyAvatarStateToVrm`.

**Units:** face angles mostly **degrees** (Kalidokit Face); arm bones **radians** (Kalidokit Pose); driver clamps and converts as needed.

---

## Module-level reference

For file-by-file structure, extended stack notes, and design ideas, see:

**[vtuber-demo/README.md](../../vtuber-demo/README.md)**
