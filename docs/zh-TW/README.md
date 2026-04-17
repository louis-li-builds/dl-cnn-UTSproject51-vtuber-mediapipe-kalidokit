# DL/CNN VTuber 示範 — 繁體中文說明

[專案總覽（根目錄）](../../README.md) · [English（完整說明）](../en/README.md) · **繁體中文（完整說明）** · [文件中心](../README.md)

[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=000)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

本專案為 **深度學習 / CNN** 課程用的瀏覽器端 **VTuber 動補示範**：以 **MediaPipe Holistic** 取得臉部、身體與手部關鍵點，經 **Kalidokit** 解算後，由 **three.js** 與 **@pixiv/three-vrm** 驅動 **VRM** 角色。

**現況：** 攝影機畫面、關鍵點疊加、動作參數面板、VRM 重定向（頭、手臂、手、表情、手指捲曲）。**three.js / three-vrm** 透過 **CDN import map** 載入；**Kalidokit** 以 **npm** 安裝並以 **ESM** 引入。請在 **localhost** 或 **HTTPS** 環境開啟，並允許 **相機** 權限。

---

## 儲存庫結構

| 路徑 | 說明 |
|------|------|
| `vtuber-demo/` | 可執行的靜態網頁：`index.html`、`src/`、`assets/models/avatar.vrm` |
| `vtuber-demo/src/tracking/` | 攝影機、MediaPipe Holistic、追蹤結果整理 |
| `vtuber-demo/src/motion/` | Kalidokit 與幾何運算 → `motionState`、平滑 |
| `vtuber-demo/src/avatar/` | VRM 載入、`motionState` → `avatarState`、骨架與表情套用 |
| `vtuber-demo/src/render/` | three.js 場景與繪製迴圈 |
| `docs/` | 文件中心（本說明與英文版） |

根目錄可有選用的 npm 設定；**請在 `vtuber-demo/` 目錄執行安裝與啟動**。

---

## 環境需求

- **Node.js 18+**（`npm` / `npx serve`）
- **網路攝影機**與支援 **getUserMedia** 的瀏覽器

---

## 快速開始

```bash
git clone https://github.com/LouisLi1020/dl-cnn-UTSproject52-vtuber-mediapipe-kalidokit.git
cd dl-cnn-UTSproject52-vtuber-mediapipe-kalidokit/vtuber-demo
npm install
npm start
```

開啟終端機顯示的網址（常為 **http://localhost:3000**），並允許使用相機。

---

## 指令（於 `vtuber-demo/`）

| 指令 | 用途 |
|------|------|
| `npm install` | 安裝 `kalidokit` 等依賴 |
| `npm start` | `npx serve .`，以靜態伺服器提供 ES modules 與 import map |

---

## 流程概要

1. **啟動**（`src/main.js`）：開啟攝影機 → 建立 three.js 場景 → 載入 VRM → 啟動 Holistic 追蹤。
2. **每一幀**：`buildTrackingResult` → `buildMotionState`（臉 / 姿勢 / 手）→ 平滑 → `mapMotionStateToAvatarState` → `applyAvatarStateToVrm`。

**單位：** 臉部角度多為 **度**（Kalidokit Face）；手臂骨架旋轉為 **弳度**（Kalidokit Pose）；驅動層會做轉換與限制。

---

## 模組細節（英文）

逐檔說明、技術棧細節與設計重點見：

**[vtuber-demo/README.md](../../vtuber-demo/README.md)**（英文）
