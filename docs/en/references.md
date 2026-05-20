# External references

> Inspiration and related projects for this work. **Respect each upstream license and citation requirements.**

## Dataset

- [HaGRID — `Hagrid_v1` branch](https://github.com/hukenovs/hagrid/tree/Hagrid_v1) — large-scale hand-gesture image classification. **Follow the official README** for what is shipped (RGB + labels only vs any precomputed landmarks), filenames, and license. The default course path is **image → CNN → class**. If you add a landmark-derived feature pipeline, document it separately from the live browser MediaPipe path.

## Video / mocap inspiration

- [webcammocap (X / Twitter)](https://x.com/webcammocap/status/2035989929382367379?s=46)

## Open source (related directions)

- [SysMocap](https://github.com/xianfei/SysMocap)
- [SystemAnimatorOnline](https://github.com/ButzYung/SystemAnimatorOnline)
- [Live3D](https://github.com/qwlp20/Live3D)

## Mapping in this repository

- **Browser demo**: application code is being restarted; VRM assets live under `vtuber-demo/assets/models/`.
- **Design and planning**: `internal-doc/` (includes `figma/`, bilingual roadmaps under `internal-doc/en/` and `internal-doc/zh-Hant/`).
- **Offline training**: `offline-training/` (see `offline-training/docs/en/README.md`).
- **Architecture reference** (course skeleton, sibling path in the workspace): `DL & CNN/A3/v1/vtuber-demo-skeleton/vtuber-demo/README.md`.
