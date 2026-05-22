import { cropHandFromVideo } from "./handCrop.js";

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

function createSideChannel() {
  return {
    busy: false,
    lastRunMs: 0,
    latest: { label: null, confidence: null, latencyMs: null },
    raw: { label: null, confidence: null },
    stableLabel: null,
    stableCount: 0,
  };
}

function emptySideSnapshot() {
  return {
    label: null,
    confidence: null,
    stableLabel: null,
    stableConfidence: null,
    rawLabel: null,
    rawConfidence: null,
    latencyMs: null,
  };
}

/**
 * Exp02 HAGRID classifier — per-hand ONNX (left + right), non-blocking schedule().
 */
export function createGestureClassifier(config) {
  const state = {
    ready: false,
    disabledReason: "not loaded",
    session: null,
    ort: null,
    left: createSideChannel(),
    right: createSideChannel(),
  };

  async function loadOrt() {
    if (state.ort) return state.ort;
    state.ort = await import(/* @vite-ignore */ ORT_CDN);
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

  function updateStable(channel, label, confidence) {
    if (label === channel.stableLabel) {
      channel.stableCount += 1;
    } else {
      channel.stableLabel = label;
      channel.stableCount = 1;
    }

    if (
      channel.stableCount >= config.stableFrames &&
      confidence >= config.minConfidence
    ) {
      channel.latest.label = label;
      channel.latest.confidence = confidence;
    } else if (confidence < config.minConfidence * 0.75) {
      channel.latest.label = null;
      channel.latest.confidence = confidence;
    }
  }

  async function runInferenceForSide(video, trackingResult, side) {
    if (!state.ready || !state.session) return;

    const channel = state[side];
    const hand = trackingResult?.hands?.[side];
    if (!hand?.detected || !hand.landmarks?.length) {
      channel.latest.label = null;
      channel.latest.confidence = null;
      channel.raw.label = null;
      channel.raw.confidence = null;
      return;
    }

    const now = performance.now();
    if (channel.busy || now - channel.lastRunMs < config.inferenceIntervalMs) {
      return;
    }

    const crop = cropHandFromVideo({
      video,
      landmarks: hand.landmarks,
      outSize: config.imgSize,
      margin: config.cropMargin,
    });
    if (!crop) return;

    channel.busy = true;
    channel.lastRunMs = now;
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
      channel.latest.latencyMs = performance.now() - t0;
      channel.raw.label = label;
      channel.raw.confidence = bestProb;
      updateStable(channel, label, bestProb);
    } catch (error) {
      console.warn(`[gesture] ${side} inference failed:`, error);
    } finally {
      channel.busy = false;
    }
  }

  function schedule(video, trackingResult) {
    if (!state.ready || !video) return;

    for (const side of ["left", "right"]) {
      const channel = state[side];
      if (channel.busy) continue;
      queueMicrotask(() => {
        void runInferenceForSide(video, trackingResult, side);
      });
    }
  }

  function sideSnapshot(side) {
    const channel = state[side];
    return {
      side,
      label: channel.latest.label,
      confidence: channel.latest.confidence,
      stableLabel: channel.latest.label,
      stableConfidence: channel.latest.confidence,
      rawLabel: channel.raw.label,
      rawConfidence: channel.raw.confidence,
      latencyMs: channel.latest.latencyMs,
    };
  }

  function getSnapshot() {
    return {
      enabled: state.ready,
      disabledReason: state.disabledReason,
      left: sideSnapshot("left"),
      right: sideSnapshot("right"),
      /** @deprecated use left/right */
      label: sideSnapshot("right").label ?? sideSnapshot("left").label,
      confidence:
        sideSnapshot("right").confidence ?? sideSnapshot("left").confidence,
      side: sideSnapshot("right").label
        ? "right"
        : sideSnapshot("left").label
          ? "left"
          : null,
      rawLabel:
        sideSnapshot("right").rawLabel ?? sideSnapshot("left").rawLabel,
      rawConfidence:
        sideSnapshot("right").rawConfidence ??
        sideSnapshot("left").rawConfidence,
      latencyMs:
        sideSnapshot("right").latencyMs ?? sideSnapshot("left").latencyMs,
    };
  }

  return {
    init,
    schedule,
    getSnapshot,
  };
}
