/**
 * Optional WebSocket JSON forward (for OBS bridges, custom receivers, or future VMC adapters).
 * Receiver example: `npx --yes wscat -l 8765` then connect to ws://127.0.0.1:8765
 */

function compactAvatarState(avatarState) {
  if (!avatarState) return null;
  return {
    lookAt: avatarState.lookAt,
    expressions: avatarState.expressions,
    bones: avatarState.bones,
    fingers: avatarState.fingers,
  };
}

export function createMocapForward(config = {}) {
  const enabled = Boolean(config.enabled && config.url);
  const intervalMs = Math.max(8, config.intervalMs ?? 33);

  let ws = null;
  let lastSendMs = 0;
  let reconnectTimer = null;
  let disposed = false;

  function clearReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function connect() {
    if (!enabled || disposed) return;
    clearReconnect();
    try {
      ws = new WebSocket(config.url);
      ws.addEventListener("open", () => {
        console.info("[mocap-forward] WebSocket open:", config.url);
      });
      ws.addEventListener("error", (e) => {
        console.warn("[mocap-forward] error:", e?.message ?? e);
      });
      ws.addEventListener("close", () => {
        ws = null;
        if (!disposed && enabled) {
          reconnectTimer = setTimeout(connect, Math.max(2000, config.reconnectMs ?? 3000));
        }
      });
    } catch (e) {
      console.warn("[mocap-forward] connect failed:", e?.message ?? e);
      if (!disposed && enabled) {
        reconnectTimer = setTimeout(connect, Math.max(2000, config.reconnectMs ?? 3000));
      }
    }
  }

  if (enabled) {
    connect();
  }

  function send(avatarState, timestampMs) {
    if (!enabled || disposed) return;
    const now = performance.now();
    if (now - lastSendMs < intervalMs) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      type: "vtuber-demo-avatar",
      v: 1,
      t: timestampMs,
      state: compactAvatarState(avatarState),
    };

    try {
      ws.send(JSON.stringify(payload));
      lastSendMs = now;
    } catch (e) {
      console.warn("[mocap-forward] send failed:", e?.message ?? e);
    }
  }

  function dispose() {
    disposed = true;
    clearReconnect();
    if (ws) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      ws = null;
    }
  }

  return {
    enabled,
    send,
    dispose,
  };
}
