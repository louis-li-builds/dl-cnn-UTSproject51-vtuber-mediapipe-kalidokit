/**
 * Lightweight ring buffer for the UI “System log” panel.
 * Append-only + line cap keeps React updates cheap.
 */

import { patchRuntime } from "./runtimeStore.js";

const MAX_LINES = 64;

/** @type {string[]} */
const lines = [];

function formatTime() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function syncUi() {
  patchRuntime({ logText: lines.join("\n") });
}

/**
 * @param {string} tag short category e.g. boot, vrm, track, gesture
 * @param {string} message
 */
export function logSystem(tag, message) {
  const line = `[${formatTime()}] [${tag}] ${message}`;
  lines.push(line);
  if (lines.length > MAX_LINES) {
    lines.splice(0, lines.length - MAX_LINES);
  }
  syncUi();
}

/** Replace entire log (e.g. user cleared panel). */
export function clearSystemLog() {
  lines.length = 0;
  syncUi();
}

export function getSystemLogText() {
  return lines.join("\n");
}
