# `artifacts/best/` (deployment bundle)

Written when **`gesture_cnn_training.ipynb`** Section 5 finishes (best run copied here), or overwrite manually.

| File | Purpose |
|------|---------|
| `gesture.onnx` | Classifier (input `N×3×224×224`, output logits). |
| `label_map.json` | `{"0": "class_a", "1": "class_b", ...}` |
| `meta.json` | `input_size`, `num_classes`, `val_accuracy`, `experiment`, … |

The `vtuber-demo` gesture module should load these paths after the app is initialized.

繁體說明：同目錄產物可由 notebook 自動複製；`label_map.json` 的鍵為類別索引字串。
