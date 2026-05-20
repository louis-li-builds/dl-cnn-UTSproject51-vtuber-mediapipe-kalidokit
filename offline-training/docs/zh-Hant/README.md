# 離線訓練（手勢 CNN）

以 **單一 Jupyter notebook**（`gesture_cnn_training.ipynb`）完成：子集 → **三種 CNN** 訓練與驗證 → 依驗證 **accuracy**（同分則較低 val loss）選 **best** → 匯出 **ONNX** + `label_map.json` 至 `artifacts/best/`，供日後 `vtuber-demo` 手勢模組載入。

English version: [../en/README.md](../en/README.md)

---

## 快速開始

1. 建議 Python **3.10+**，在 **`offline-training`** 目錄：

   ```bash
   cd offline-training
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   pip install jupyter ipywidgets
   ```

2. 用 Jupyter 或 VS Code 開啟 `gesture_cnn_training.ipynb`，**由上而下**執行。

3. 預設 **`DATA_DIR`** 為 **`data/hagrid`**（需 `train/`、`val/` 的 ImageFolder）。僅測管線且無影像時，在 **第 1 節** 設 **`USE_TOY_DATA = True`**，第 2 節會建立 **`data/toy`**。正式訓練見 `data/README.md`；上游資料集：[HaGRID](https://github.com/hukenovs/hagrid)。

---

## 資料與產物

- 資料夾結構：`../data/README.md`
- 每次實驗輸出：`artifacts/experiments/<實驗名>/`
- **上線用**：`artifacts/best/`（見 `artifacts/best/README.md`）

---

## 實驗設計

- **三組**：`ShallowCNN`（scratch）、`MediumCNN`（BN + dropout）、`ResNet-18`（ImageNet transfer）。
- **選 best**：`val_accuracy` 高者勝；同分 **val_loss** 低者勝；結果見 `artifacts/best/selection.json`。

---

## 與即時 demo

| 分支 | 說明 |
|------|------|
| **即時** | `vtuber-demo`：MediaPipe → Kalidokit → VRM。 |
| **離線** | 本 notebook：影像分類 → 匯出 → 瀏覽器手勢推論（demo 初始化後實作）。 |

HaGRID 以官方 README 為準；若僅 RGB 分類，請在報告中寫清楚，勿與即時 Holistic 管線混淆。

---

## 參考

- 路線圖：`../../internal-doc/zh-Hant/roadmap.md`
- 外部連結：`../../docs/zh-Hant/references.md`
