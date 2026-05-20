# Offline training (gesture CNN)

End-to-end flow in **one notebook** (`gesture_cnn_training.ipynb`): subset → train **three** CNN variants → pick **best** by validation accuracy (tie-break: lower val loss) → export **ONNX** + `label_map.json` under `artifacts/best/` for future `vtuber-demo` gesture wiring.

---

## Quick start

1. Python **3.10+**, from the **`offline-training`** directory:

   ```bash
   cd offline-training
   python3 -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   pip install jupyter ipywidgets
   ```

2. Open `gesture_cnn_training.ipynb` in Jupyter or VS Code and run **top to bottom**.

3. Default **`DATA_DIR`** is **`data/hagrid`** (ImageFolder `train/` / `val/`). For a smoke run without images, set **`USE_TOY_DATA = True`** in **Section 1**; **Section 2** then creates **`data/toy`**. See `data/README.md` for layout and [HaGRID](https://github.com/hukenovs/hagrid) for the upstream dataset.

---

## Layout and artifacts

- Dataset layout: `../data/README.md`
- Per-experiment outputs: `artifacts/experiments/<experiment_name>/` (`checkpoint.pt`, `gesture.onnx`, `metrics.json`, …)
- **Deployment bundle**: `artifacts/best/` — see `artifacts/best/README.md`

---

## Experiments

- **Three models**: `ShallowCNN` (scratch), `MediumCNN` (BN + dropout), `ResNet-18` (ImageNet transfer).
- **Best selection**: higher `val_accuracy`; ties broken by lower `val_loss`. Summary in `artifacts/best/selection.json`.

---

## Relation to the browser demo

| Track | Role |
|-------|------|
| **Live** | `vtuber-demo`: MediaPipe landmarks → Kalidokit → VRM. |
| **Offline** | This notebook: image CNN → export → browser gesture head (after demo init). |

HaGRID license and fields follow the upstream README. If you only train on RGB labels, state that clearly and do not conflate with the live Holistic stream.

---

## See also

- Roadmap: `../../internal-doc/en/roadmap.md`
- External links: `../../docs/en/references.md`
- 繁體中文說明: [../zh-Hant/README.md](../zh-Hant/README.md)
