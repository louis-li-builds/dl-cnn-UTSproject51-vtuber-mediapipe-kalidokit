import { useEffect, useRef } from "react";
import { bootVtuberPipeline } from "../../pipeline/boot.js";

export function useVtuberPipeline(
  webcamMount: HTMLElement | null,
  avatarMount: HTMLElement | null,
  avatarId: string
) {
  const pipelineRef = useRef<Awaited<ReturnType<typeof bootVtuberPipeline>> | null>(
    null
  );
  const avatarIdRef = useRef(avatarId);
  avatarIdRef.current = avatarId;

  useEffect(() => {
    if (!webcamMount || !avatarMount) return;

    let cancelled = false;

    void bootVtuberPipeline({
      webcamMount,
      avatarMount,
      avatarId: avatarIdRef.current,
    }).then((api) => {
      if (cancelled) {
        api.destroy();
        return;
      }
      pipelineRef.current = api;
    });

    return () => {
      cancelled = true;
      pipelineRef.current?.destroy();
      pipelineRef.current = null;
    };
  }, [webcamMount, avatarMount]);

  useEffect(() => {
    const api = pipelineRef.current;
    if (!api) return;
    void api.setAvatarId(avatarId);
  }, [avatarId]);
}
