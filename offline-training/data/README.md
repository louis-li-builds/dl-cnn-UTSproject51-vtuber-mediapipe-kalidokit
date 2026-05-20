# Dataset layout

Training uses **torchvision.ImageFolder**:

```text
<DATA_ROOT>/
├─ train/
│  ├─ <class_a>/*.jpg|png|...
│  └─ ...
└─ val/
   └─ ...
```

- **Class name** = subdirectory name (written to `label_map.json`).
- **HaGRID**: map the official extract to this layout; use a subset when needed.

Without real data, set `USE_TOY_DATA = True` in **Section 1** of `gesture_cnn_training.ipynb` and run **Section 2** to create `data/toy` (smoke test only).

Traditional Chinese notes: [../docs/zh-Hant/data-layout.md](../docs/zh-Hant/data-layout.md)
