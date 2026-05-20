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

    bootVtuberPipeline({
      webcamMount,
      avatarMount,
      avatarId: avatarIdRef.current,
    }).then((api) => {
      if (cancelled) {
        api.destroy();
        return;
      }
      pipelineRef.current = api;
      void api.setAvatarId(avatarIdRef.current);
    });

    return () => {
      cancelled = true;
      pipelineRef.current?.destroy();
      pipelineRef.current = null;
    };
  }, [webcamMount, avatarMount]);

  useEffect(() => {
    void pipelineRef.current?.setAvatarId(avatarId);
  }, [avatarId]);
}
