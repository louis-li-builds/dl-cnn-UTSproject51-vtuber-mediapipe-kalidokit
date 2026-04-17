export async function initWebcam(container) {
  if (!container) {
    throw new Error("Webcam container not found.");
  }

  container.innerHTML = "";
  container.style.overflow = "hidden";

  const stage = document.createElement("div");
  stage.style.position = "relative";
  stage.style.display = "flex";
  stage.style.alignItems = "center";
  stage.style.justifyContent = "center";
  stage.style.lineHeight = "0";
  stage.style.width = "100%";
  stage.style.height = "100%";
  stage.style.minHeight = "0";

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
  video.style.objectFit = "contain";
  video.style.transform = "scaleX(-1)";

  stage.appendChild(video);
  container.appendChild(stage);

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: "user",
    },
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
    container,
    stage,
  };
}