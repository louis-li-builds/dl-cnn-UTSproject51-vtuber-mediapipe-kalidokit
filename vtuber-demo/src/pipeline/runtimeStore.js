/** Lightweight store so React panels can subscribe to pipeline status / motion / logs. */

const initialState = {
  status: "Loading…",
  isConnected: false,
  motionText: "Waiting for tracking data…",
  logText: "",
};

let state = { ...initialState };
const listeners = new Set();

export function getRuntimeState() {
  return state;
}

export function subscribeRuntime(listener) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) {
    listener(state);
  }
}

export function patchRuntime(partial) {
  state = { ...state, ...partial };
  if (partial.status !== undefined) {
    state.isConnected =
      partial.status === "Running" || partial.status === "Camera ready";
  }
  emit();
}
