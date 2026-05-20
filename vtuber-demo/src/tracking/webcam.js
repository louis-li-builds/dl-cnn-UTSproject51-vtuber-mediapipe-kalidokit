const VIDEO_PROFILES = {
  /** Default balance */
  standard: { width: { ideal: 1280 }, height: { ideal: 720 } },
  /** Larger frame if the camera / browser honours it (not optical wide-angle). */
  wide: { width: { ideal: 1920 }, height: { ideal: 1080 } },
  /** Lighter CPU / bandwidth */
  compact: { width: { ideal: 640 }, height: { ideal: 480 } },
};

function applyVideoVisualStyle(video, { objectFit = "contain", digitalZoom = 1 }) {
  video.style.objectFit = objectFit;
  const z = Math.max(0.72, Math.min(1, digitalZoom));
  video.style.transformOrigin = "center center";
  video.style.transform = `scaleX(-1) scale(${z})`;
}

export async function initWebcam(mountElement, options = {}) {
  if (!mountElement) {
    throw new Error("Webcam mount element is required.");
  }

  mountElement.innerHTML = "";

  const stage = document.createElement("div");
  stage.style.position = "relative";
  stage.style.display = "flex";
  stage.style.alignItems = "center";
  stage.style.justifyContent = "center";
  stage.style.lineHeight = "0";
  stage.style.width = "100%";
  stage.style.height = "100%";
  stage.style.minHeight = "0";
  stage.style.overflow = "hidden";

  const video = document.createElement("video");
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.style.display = "block";
  video.style.width = "100%";
  video.style.height = "auto";
  video.style.maxWidth = "100%";
  video.style.maxHeight = "100%";
  video.style.borderRadius = "10px";
  video.style.background = "#000";

  const profileKey = options.videoProfile ?? "standard";
  const visual = {
    objectFit: options.objectFit ?? "contain",
    digitalZoom: options.digitalZoom ?? 1,
  };
  applyVideoVisualStyle(video, visual);

  stage.appendChild(video);
  mountElement.appendChild(stage);

  const videoConstraints = {
    ...VIDEO_PROFILES[profileKey],
    facingMode: "user",
  };

  const stream = await navigator.mediaDevices.getUserMedia({
    video: videoConstraints,
    audio: false,
  });

  video.srcObject = stream;

  await new Promise((resolve) => {
    video.onloadedmetadata = () => resolve();
  });

  await video.play();

  return {
    video,
    stream,
    container: mountElement,
    stage,
    profileKey,
    setVisual(partial) {
      if (partial.objectFit !== undefined) visual.objectFit = partial.objectFit;
      if (partial.digitalZoom !== undefined) visual.digitalZoom = partial.digitalZoom;
      applyVideoVisualStyle(video, visual);
    },
  };
}

export function stopWebcamStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
}

/**
 * Hot-swap camera resolution profile. Caller must restart tracking if needed.
 */
export async function restartWebcamStream(video, oldStream, profileKey) {
  stopWebcamStream(oldStream);

  const key = VIDEO_PROFILES[profileKey] ? profileKey : "standard";
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      ...VIDEO_PROFILES[key],
      facingMode: "user",
    },
    audio: false,
  });

  video.srcObject = stream;

  await new Promise((resolve) => {
    video.onloadedmetadata = () => resolve();
  });

  await video.play();

  return { stream, profileKey: key };
}

export { VIDEO_PROFILES };
