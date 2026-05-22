import {
  cropHandFromVideo,
  pickHandForGesture,
  pickHandSideForAlternatingInference,
  shouldClassifyBothHands,
} from "./handCrop.js";

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
    latest: { label: null, confidence: null, latencyMs: null },
    raw: { label: null, confidence: null },
    stableLabel: null,
    stableCount: 0,
  };
}

function sideSnapshot(channel) {
  return {
    label: channel.latest.label,
    confidence: channel.latest.confidence,
    stableLabel: channel.latest.label,
    stableConfidence: channel.latest.confidence,
    rawLabel: channel.raw.label,
    rawConfidence: channel.raw.confidence,
    latencyMs: channel.latest.latencyMs,
  };
}

/**
 * Set A (Exp02) gesture classifier: throttled ONNX on a hand crop.
 * Holistic + VRM stay on the animation frame loop; CNN runs at most ~10 Hz (see gesture-model.json).
 */
export function createGestureClassifier(config) {
  const classifyBoth = shouldClassifyBothHands(config);

  const state = {
    ready: false,
    disabledReason: "not loaded",
    session: null,
    ort: null,
    busy: false,
    lastRunMs: 0,
    pending: false,
    alternateSide: "right",
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
    bySide: {
      left: createSideChannel(),
      right: createSideChannel(),
    },
  };

  async function loadOrt() {
    if (state.ort) return state.ort;
    state.ort = await import(/* @vite-ignore */ ORT_CDN);
    state.ort.env.wasm.wasmPaths =
      "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";
    return state.ort;
  }

  function resolveModelUrl(url) {
    if (typeof url !== "string" || !url) return url;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const base = typeof location !== "undefined" ? location.origin : "";
    const path = url.startsWith("/") ? url : `/${url.replace(/^\.\//, "")}`;
    return `${base}${path}`;
  }

  async function createSessionFromUrl(ort, modelUrl, executionProviders) {
    const absUrl = resolveModelUrl(modelUrl);
    const response = await fetch(absUrl);
    if (!response.ok) {
      throw new Error(`model fetch failed (${response.status})`);
    }
    const onnxBuffer = await response.arrayBuffer();

    const externalUrl = `${absUrl}.data`;
    let externalData;
    try {
      const extResp = await fetch(externalUrl);
      if (extResp.ok) {
        const dataBuffer = await extResp.arrayBuffer();
        const fileName = absUrl.split("/").pop() ?? "model.onnx";
        externalData = [{ path: `${fileName}.data`, data: dataBuffer }];
      }
    } catch {
      /* single-file ONNX */
    }

    const sessionOpts = {
      graphOptimizationLevel: "all",
      executionProviders,
    };

    if (externalData?.length) {
      return ort.InferenceSession.create(onnxBuffer, {
        ...sessionOpts,
        externalData,
      });
    }
    return ort.InferenceSession.create(onnxBuffer, sessionOpts);
  }

  async function init() {
    try {
      const ort = await loadOrt();
      const absUrl = resolveModelUrl(config.modelUrl);
      const head = await fetch(absUrl, { method: "HEAD" });
      if (!head.ok) {
        state.disabledReason = "model file not found";
        return state;
      }

      try {
        state.session = await createSessionFromUrl(ort, config.modelUrl, [
          "webgpu",
          "wasm",
        ]);
      } catch (webGpuError) {
        console.warn("[gesture] WebGPU session failed, using wasm:", webGpuError);
        state.session = await createSessionFromUrl(ort, config.modelUrl, ["wasm"]);
      }

      state.ready = true;
      state.disabledReason = null;
    } catch (error) {
      state.disabledReason = error.message;
      console.warn("[gesture] disabled:", error);
    }
    return state;
  }

  function updateStableSingle(label, confidence) {
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

  function updateStableSide(side, label, confidence) {
    const channel = state.bySide[side];
    if (!channel) return;

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

  async function inferCrop(crop, t0) {
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
    return {
      label,
      confidence: bestProb,
      latencyMs: performance.now() - t0,
    };
  }

  async function runInferenceBoth(video, trackingResult) {
    const picked = pickHandSideForAlternatingInference(
      trackingResult,
      state.alternateSide
    );
    if (!picked) {
      return;
    }

    state.alternateSide = picked.side;

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
      const { label, confidence, latencyMs } = await inferCrop(crop, t0);
      const channel = state.bySide[picked.side];
      channel.latest.latencyMs = latencyMs;
      channel.raw.label = label;
      channel.raw.confidence = confidence;
      updateStableSide(picked.side, label, confidence);
    } catch (error) {
      console.warn("[gesture] inference failed:", error);
    } finally {
      state.busy = false;
      state.lastRunMs = performance.now();
    }
  }

  async function runInferenceSingle(video, trackingResult) {
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
      const { label, confidence, latencyMs } = await inferCrop(crop, t0);
      state.latest.side = picked.side;
      state.latest.latencyMs = latencyMs;
      state.raw.label = label;
      state.raw.confidence = confidence;
      updateStableSingle(label, confidence);
    } catch (error) {
      console.warn("[gesture] inference failed:", error);
    } finally {
      state.busy = false;
      state.lastRunMs = performance.now();
    }
  }

  async function runInference(video, trackingResult) {
    if (!state.ready || state.busy || !state.session) return;

    if (classifyBoth) {
      await runInferenceBoth(video, trackingResult);
    } else {
      await runInferenceSingle(video, trackingResult);
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
    if (classifyBoth) {
      return {
        enabled: state.ready,
        disabledReason: state.disabledReason,
        dualHand: true,
        bySide: {
          left: sideSnapshot(state.bySide.left),
          right: sideSnapshot(state.bySide.right),
        },
        label: state.bySide.right.latest.label ?? state.bySide.left.latest.label,
        confidence:
          state.bySide.right.latest.confidence ??
          state.bySide.left.latest.confidence,
        side: null,
        latencyMs:
          state.bySide.right.latest.latencyMs ??
          state.bySide.left.latest.latencyMs,
      };
    }

    return {
      enabled: state.ready,
      disabledReason: state.disabledReason,
      dualHand: false,
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
