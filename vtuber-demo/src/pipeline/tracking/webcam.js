const VIDEO_PROFILES = {
  standard: { width: { ideal: 1280 }, height: { ideal: 720 } },
  wide: { width: { ideal: 1920 }, height: { ideal: 1080 } },
  compact: { width: { ideal: 640 }, height: { ideal: 480 } },
};

const heldStreams = new Set();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyVideoVisualStyle(video, { objectFit = "contain", digitalZoom = 1 }) {
  video.style.objectFit = objectFit;
  const z = Math.max(0.72, Math.min(1, digitalZoom));
  video.style.transformOrigin = "center center";
  video.style.transform = `scaleX(-1) scale(${z})`;
}

export function releaseAllWebcamTracks() {
  for (const stream of heldStreams) {
    stream.getTracks().forEach((t) => t.stop());
  }
  heldStreams.clear();
}

function trackStream(stream) {
  if (stream) heldStreams.add(stream);
}

export function stopWebcamStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
  heldStreams.delete(stream);
}

function buildAttempts(profileKey) {
  const key = VIDEO_PROFILES[profileKey] ? profileKey : "compact";
  return [
    { video: { ...VIDEO_PROFILES[key], facingMode: "user" } },
    { video: { ...VIDEO_PROFILES.compact, facingMode: "user" } },
    { video: { facingMode: "user" } },
    { video: true },
  ];
}

export async function acquireWebcamStream(profileKey = "compact", options = {}) {
  const warmupMs = options.warmupMs ?? 250;
  const maxAttempts = options.maxAttempts ?? 4;
  const attempts = buildAttempts(profileKey);

  releaseAllWebcamTracks();
  await delay(warmupMs);

  let lastError = null;
  for (let round = 0; round < maxAttempts; round += 1) {
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          ...constraints,
          audio: false,
        });
        trackStream(stream);
        return stream;
      } catch (error) {
        lastError = error;
      }
    }
    releaseAllWebcamTracks();
    await delay(300 + round * 200);
  }

  throw new Error(
    `${lastError?.name ?? "Error"}: ${lastError?.message ?? "getUserMedia failed"}`
  );
}

async function bindStreamToVideo(video, stream) {
  video.srcObject = stream;
  await new Promise((resolve) => {
    if (video.readyState >= 1) {
      resolve();
      return;
    }
    video.onloadedmetadata = () => resolve();
  });
  await video.play();
}

export async function initWebcam(mountElement, options = {}) {
  if (!mountElement) {
    throw new Error("Webcam mount element is required.");
  }

  mountElement.innerHTML = "";

  const stage = document.createElement("div");
  stage.style.cssText =
    "position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:0;overflow:hidden;line-height:0";

  const video = document.createElement("video");
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.style.cssText =
    "display:block;width:100%;height:auto;max-width:100%;max-height:100%;border-radius:10px;background:#000";

  const profileKey = options.videoProfile ?? "compact";
  applyVideoVisualStyle(video, {
    objectFit: options.objectFit ?? "contain",
    digitalZoom: options.digitalZoom ?? 1,
  });

  stage.appendChild(video);
  mountElement.appendChild(stage);

  const stream = await acquireWebcamStream(profileKey, {
    warmupMs: options.warmupMs,
    maxAttempts: options.maxAttempts,
  });
  await bindStreamToVideo(video, stream);

  return {
    video,
    stream,
    container: mountElement,
    stage,
    profileKey,
    stop() {
      stopWebcamStream(stream);
      video.srcObject = null;
    },
  };
}

export { VIDEO_PROFILES };
