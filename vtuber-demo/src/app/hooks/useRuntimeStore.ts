import { useEffect, useState } from "react";
import { getRuntimeState, subscribeRuntime } from "../../pipeline/runtimeStore.js";

export function useRuntimeStore() {
  const [state, setState] = useState(getRuntimeState);

  useEffect(() => subscribeRuntime(setState), []);

  return state;
}
