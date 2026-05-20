# Demo runtime configuration (`demo-config.json`)

Place `demo-config.json` next to `index.html` (served as `./demo-config.json`). If the file is missing, built-in defaults apply.

## `holistic.detectMaxWidth`

When **greater than zero**, Holistic runs on an offscreen canvas scaled to that maximum width (same aspect ratio as the webcam). This mirrors the “use a smaller capture size for speed/stability” idea used in commercial webcam mocap apps.

- `0` — run the model on the full-resolution video (higher CPU/GPU load).

## `smoothing`

| Field | Meaning |
|-------|---------|
| `mode` | `"oneEuro"` (default) or `"lerp"` |
| `alpha` | Used only for `lerp` (0–1). |
| `oneEuro.minCutoff` | Minimum cutoff frequency (Hz). Higher = less smoothing when still. |
| `oneEuro.beta` | Speed of cutoff increase with motion; higher = less lag when moving. |
| `oneEuro.dCutoff` | Cutoff for derivative filter. |

One Euro reference: [1€ filter](https://cristal.univ-lille.fr/~casiez/1euro/).

## `forward` (optional JSON/WebSocket export)

Lightweight **JSON** stream of `avatarState` (bones, fingers, lookAt, expressions) for custom receivers—not full VMC binary.

| Field | Meaning |
|-------|---------|
| `enabled` | `true` to open a WebSocket client. |
| `url` | e.g. `ws://127.0.0.1:8765` |
| `intervalMs` | Minimum time between sends (default 33 ≈ 30 Hz). |
| `reconnectMs` | Delay before reconnect after disconnect. |

**Quick test receiver** (Node): `npx --yes wscat -l 8765` then set `"enabled": true`.

Payload shape:

```json
{
  "type": "vtuber-demo-avatar",
  "v": 1,
  "t": 12345.6,
  "state": { "bones": {}, "fingers": {}, "lookAt": {}, "expressions": {} }
}
```
