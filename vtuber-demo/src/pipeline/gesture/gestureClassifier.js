import { cropHandFromVideo, pickHandForGesture } from "./handCrop.js";

const ORT_CDN = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.mjs";

function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

function canvasToTensor(canvas, imgSize, normalize) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { data } = ctx.getImageData(0, 0, imgSize, imgSize);
  const mean = normalize.mean;
  const std = normalize.std;
  const tensor = new Float32Array(3 * imgSize * imgSize);
  const plane = imgSize * imgSize;

  for (let i = 0; i < plane; i += 1) {
    const px = i * 4;
    const r = data[px] / 255;
    const g = data[px + 1] / 255;
    const b = data[px + 2] / 255;
    tensor[i] = (r - mean[0]) / std[0];
    tensor[plane + i] = (g - mean[1]) / std[1];
    tensor[2 * plane + i] = (b - mean[2]) / std[2];
  }

  return tensor;
}

/**
 * Set A (Exp02) gesture classifier: throttled ONNX on a hand crop.
 * Holistic + VRM stay on the animation frame loop; CNN runs at most ~5 Hz.
 */
export function createGestureClassifier(config) {
  const state = {
    ready: false,
    disabledReason: "not loaded",
    session: null,
    ort: null,
    busy: false,
    lastRunMs: 0,
    pending: false,
    latest: {
      label: null,
      confidence: null,
      side: null,
      latencyMs: null,
    },
    raw: {
      label: null,
      confidence: null,
    },
    stableLabel: null,
    stableCount: 0,
  };

  async function loadOrt() {
    if (state.ort) return state.ort;
    state.ort = await import(/* webpackIgnore: true */ ORT_CDN);
    state.ort.env.wasm.wasmPaths =
      "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";
    return state.ort;
  }

  async function init() {
    try {
      const ort = await loadOrt();
      const response = await fetch(config.modelUrl, { method: "HEAD" });
      if (!response.ok) {
        state.disabledReason = "model file not found";
        return state;
      }

      state.session = await ort.InferenceSession.create(config.modelUrl, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
      state.ready = true;
      state.disabledReason = null;
    } catch (error) {
      state.disabledReason = error.message;
      console.warn("[gesture] disabled:", error);
    }
    return state;
  }

  function updateStable(label, confidence) {
    if (label === state.stableLabel) {
      state.stableCount += 1;
    } else {
      state.stableLabel = label;
      state.stableCount = 1;
    }

    if (state.stableCount >= config.stableFrames && confidence >= config.minConfidence) {
      state.latest.label = label;
      state.latest.confidence = confidence;
    } else if (confidence < config.minConfidence * 0.75) {
      state.latest.label = null;
      state.latest.confidence = confidence;
    }
  }

  async function runInference(video, trackingResult) {
    if (!state.ready || state.busy || !state.session) return;

    const picked = pickHandForGesture(trackingResult, config.preferHand);
    if (!picked) {
      state.latest.side = null;
      return;
    }

    const crop = cropHandFromVideo({
      video,
      landmarks: picked.landmarks,
      outSize: config.imgSize,
      margin: config.cropMargin,
    });
    if (!crop) return;

    state.busy = true;
    const t0 = performance.now();

    try {
      const ort = state.ort;
      const inputTensor = canvasToTensor(crop, config.imgSize, config.normalize);
      const inputName = state.session.inputNames[0];
      const feeds = {
        [inputName]: new ort.Tensor("float32", inputTensor, [
          1,
          3,
          config.imgSize,
          config.imgSize,
        ]),
      };
      const outputs = await state.session.run(feeds);
      const outputName = state.session.outputNames[0];
      const logits = Array.from(outputs[outputName].data);
      const probs = softmax(logits);
      let bestIdx = 0;
      let bestProb = probs[0];
      for (let i = 1; i < probs.length; i += 1) {
        if (probs[i] > bestProb) {
          bestProb = probs[i];
          bestIdx = i;
        }
      }

      const label = config.classNames[bestIdx] ?? `class_${bestIdx}`;
      state.latest.side = picked.side;
      state.latest.latencyMs = performance.now() - t0;
      state.raw.label = label;
      state.raw.confidence = bestProb;
      updateStable(label, bestProb);
    } catch (error) {
      console.warn("[gesture] inference failed:", error);
    } finally {
      state.busy = false;
      state.lastRunMs = performance.now();
    }
  }

  function schedule(video, trackingResult) {
    if (!state.ready) return;

    const now = performance.now();
    if (now - state.lastRunMs < config.inferenceIntervalMs) return;
    if (state.pending || state.busy) return;

    state.pending = true;
    queueMicrotask(() => {
      state.pending = false;
      void runInference(video, trackingResult);
    });
  }

  function getSnapshot() {
    return {
      enabled: state.ready,
      disabledReason: state.disabledReason,
      label: state.latest.label,
      confidence: state.latest.confidence,
      stableLabel: state.latest.label,
      stableConfidence: state.latest.confidence,
      rawLabel: state.raw.label,
      rawConfidence: state.raw.confidence,
      side: state.latest.side,
      latencyMs: state.latest.latencyMs,
    };
  }

  return {
    init,
    schedule,
    getSnapshot,
  };
}
