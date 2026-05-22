function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Axis-aligned hand bbox in pixel coordinates (landmarks are normalised 0–1).
 * Separate X/Y margin matches teammate skeleton crop helper (not HaGRID CSV bboxes).
 */
export function makeHandCropBox(video, landmarks, margin) {
  const videoWidth = video?.videoWidth ?? 0;
  const videoHeight = video?.videoHeight ?? 0;

  if (!videoWidth || !videoHeight || !landmarks?.length) {
    return null;
  }

  const xs = landmarks.map((lm) => clamp(lm.x ?? 0, 0, 1));
  const ys = landmarks.map((lm) => clamp(lm.y ?? 0, 0, 1));

  let minX = Math.min(...xs) * videoWidth;
  let maxX = Math.max(...xs) * videoWidth;
  let minY = Math.min(...ys) * videoHeight;
  let maxY = Math.max(...ys) * videoHeight;

  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;

  if (boxWidth < 8 || boxHeight < 8) {
    return null;
  }

  const marginX = boxWidth * margin;
  const marginY = boxHeight * margin;

  minX = clamp(minX - marginX, 0, videoWidth - 1);
  maxX = clamp(maxX + marginX, 1, videoWidth);
  minY = clamp(minY - marginY, 0, videoHeight - 1);
  maxY = clamp(maxY + marginY, 1, videoHeight);

  const cropWidth = maxX - minX;
  const cropHeight = maxY - minY;

  if (cropWidth < 8 || cropHeight < 8) {
    return null;
  }

  return { x: minX, y: minY, width: cropWidth, height: cropHeight };
}

const squareCanvas = document.createElement("canvas");
const resizeCanvas = document.createElement("canvas");

/**
 * Square letterbox crop (black padding) then resize — aligned with teammate
 * skeleton preprocessing for live crops; no image rotation is applied.
 */
export function cropHandFromVideo({
  video,
  landmarks,
  outSize = 224,
  margin = 0.08,
}) {
  const box = makeHandCropBox(video, landmarks, margin);
  if (!box) return null;

  const squareSide = Math.ceil(Math.max(box.width, box.height));
  squareCanvas.width = squareSide;
  squareCanvas.height = squareSide;

  const squareCtx = squareCanvas.getContext("2d", { willReadFrequently: true });
  if (!squareCtx) return null;

  squareCtx.fillStyle = "rgb(0, 0, 0)";
  squareCtx.fillRect(0, 0, squareSide, squareSide);

  const offsetX = Math.floor((squareSide - box.width) / 2);
  const offsetY = Math.floor((squareSide - box.height) / 2);

  squareCtx.drawImage(
    video,
    box.x,
    box.y,
    box.width,
    box.height,
    offsetX,
    offsetY,
    box.width,
    box.height
  );

  resizeCanvas.width = outSize;
  resizeCanvas.height = outSize;

  const resizeCtx = resizeCanvas.getContext("2d", { willReadFrequently: true });
  if (!resizeCtx) return null;

  resizeCtx.drawImage(squareCanvas, 0, 0, outSize, outSize);
  return resizeCanvas;
}

export function pickHandForGesture(trackingResult, preferHand = "right") {
  const left = trackingResult?.hands?.left;
  const right = trackingResult?.hands?.right;

  if (preferHand === "left" && left?.detected) {
    return { side: "left", landmarks: left.landmarks };
  }
  if (preferHand === "right" && right?.detected) {
    return { side: "right", landmarks: right.landmarks };
  }

  if (right?.detected) return { side: "right", landmarks: right.landmarks };
  if (left?.detected) return { side: "left", landmarks: left.landmarks };
  return null;
}

/** @returns {boolean} */
export function shouldClassifyBothHands(config) {
  return (
    config?.inferenceBothHands === true ||
    config?.preferHand === "both"
  );
}

/**
 * Next hand to classify when alternating both sides (one ONNX run per throttle tick).
 * @param {object} trackingResult
 * @param {"left"|"right"} lastSide
 */
export function pickHandSideForAlternatingInference(trackingResult, lastSide) {
  const order =
    lastSide === "left"
      ? ["right", "left"]
      : ["left", "right"];

  for (const side of order) {
    const hand = trackingResult?.hands?.[side];
    if (hand?.detected && hand.landmarks?.length) {
      return { side, landmarks: hand.landmarks };
    }
  }
  return null;
}
