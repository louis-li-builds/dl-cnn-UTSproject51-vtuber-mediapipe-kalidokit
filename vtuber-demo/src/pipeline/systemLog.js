/**
 * Append-only terminal log for the bottom hub (max 48 lines).
 */
import { patchRuntime } from "./runtimeStore.js";

const MAX_LINES = 48;
const lines = [];

export function logSystem(tag, message) {
  const t = new Date();
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  const ss = String(t.getSeconds()).padStart(2, "0");
  lines.push(`[${hh}:${mm}:${ss}] [${tag}] ${message}`);
  while (lines.length > MAX_LINES) {
    lines.shift();
  }
  patchRuntime({ logText: lines.join("\n") });
}

export function clearSystemLog() {
  lines.length = 0;
  patchRuntime({ logText: "" });
}
