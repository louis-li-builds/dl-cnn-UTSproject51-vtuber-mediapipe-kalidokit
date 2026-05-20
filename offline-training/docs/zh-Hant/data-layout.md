# 資料目錄說明（繁中）

訓練使用 **ImageFolder**：

```text
<DATA_ROOT>/
├─ train/
│  ├─ <類別A>/*.jpg|png|...
│  └─ ...
└─ val/
   └─ ...
```

- **類別名稱** = 子資料夾名稱（會寫入 `label_map.json`）。
- **HaGRID**：依官方解壓後對應到上述結構；可先取子集再訓練。

尚無真實影像、僅想測管線時：在 `gesture_cnn_training.ipynb` **第 1 節** 設 `USE_TOY_DATA = True`，再執行第 2 節會建立 `data/toy`（隨機圖，不具訓練意義）。

English: [../../data/README.md](../../data/README.md)
