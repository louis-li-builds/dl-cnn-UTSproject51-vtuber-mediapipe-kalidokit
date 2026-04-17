# DL/CNN VTuber Demo

**[Full guide (English)](docs/en/README.md)** · **[完整說明（繁體中文）](docs/zh-TW/README.md)** · [Documentation hub](docs/README.md)

[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=000)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

Browser-based **VTuber-style motion capture** demo for a **Deep Learning / CNN** course: **MediaPipe Holistic** landmarks → **Kalidokit** solving → **three.js + @pixiv/three-vrm** driving a **VRM** avatar. The runnable app lives under **`vtuber-demo/`**; this folder is a thin wrapper around that app.

**Status:** Webcam + Holistic overlay, motion panel, VRM retargeting (head, arms, hands, expressions, finger curl). Static server via **`npm start`** in `vtuber-demo/`. **CDN import map** for three.js / three-vrm; **Kalidokit** via npm + ESM. Requires **localhost or HTTPS** and **camera permission**.

---

## Documentation

| | |
|--|--|
| **English** | [docs/en/README.md](docs/en/README.md) — layout, prerequisites, quick start, scripts, pipeline summary |
| **繁體中文** | [docs/zh-TW/README.md](docs/zh-TW/README.md) — 同上完整說明 |
| **Documentation hub** | [docs/README.md](docs/README.md) — links between locales and module reference |
| **Module reference** | [vtuber-demo/README.md](vtuber-demo/README.md) — file tree, full pipeline walkthrough, design notes |

This file is the **project overview** only. Install steps and technical detail live in the guides above.

---

## How to run

```bash
cd vtuber-demo
npm install
npm start
```

Open the URL shown (often `http://localhost:3000`), allow webcam access. You should see the mirrored camera with landmarks, the VRM avatar, motion readouts, and a short status log.
