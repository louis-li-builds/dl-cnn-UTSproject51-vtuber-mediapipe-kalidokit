import { useState } from 'react';
import { AvatarSelector } from './components/AvatarSelector';
import { WebcamPreview } from './components/WebcamPreview';
import { AvatarDisplay } from './components/AvatarDisplay';
import { MotionParameters } from './components/MotionParameters';
import { LogPanel } from './components/LogPanel';
import { AppHeader } from './components/AppHeader';
import { CollapsiblePanel } from './components/CollapsiblePanel';
import { useVtuberPipeline } from './hooks/useVtuberPipeline';
import { useRuntimeStore } from './hooks/useRuntimeStore';

/** Fixed sidebar widths (px-level via Tailwind scale). */
const LEFT_SIDEBAR_W = 'w-56'; /* 14rem ≈ 224px */
const RIGHT_SIDEBAR_W = 'w-80'; /* 20rem ≈ 320px — motion text benefits from width */
/** Bottom log hub: fixed band height, scroll inside panel. */
const BOTTOM_LOG_H = 'h-48 min-h-[12rem] max-h-[38vh]';

export default function App() {
  const [selectedAvatarId, setSelectedAvatarId] = useState('1');
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
  const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState(false);
  const [isPrimaryViewAvatar, setIsPrimaryViewAvatar] = useState(true);
  const [webcamMount, setWebcamMount] = useState<HTMLElement | null>(null);
  const [avatarMount, setAvatarMount] = useState<HTMLElement | null>(null);

  const runtime = useRuntimeStore();
  useVtuberPipeline(webcamMount, avatarMount, selectedAvatarId);

  const handleSwapView = () => {
    setIsPrimaryViewAvatar(!isPrimaryViewAvatar);
  };

  return (
    <div className="size-full bg-zinc-950 flex flex-col overflow-hidden">
      <AppHeader
        isConnected={runtime.isConnected}
        status={runtime.status}
        fps={runtime.isConnected ? 60 : 0}
      />

      <div className="flex flex-1 min-h-0 w-full">
        {/* Left: fixed width, scroll inside list */}
        {!isLeftSidebarCollapsed ? (
          <aside
            className={`${LEFT_SIDEBAR_W} shrink-0 flex flex-col min-h-0 border-r border-zinc-800 bg-zinc-950`}
          >
            <CollapsiblePanel
              isCollapsed={isLeftSidebarCollapsed}
              onToggle={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
              direction="left"
            >
              <div className="h-full min-h-0 flex flex-col overflow-hidden">
                <AvatarSelector
                  selectedAvatarId={selectedAvatarId}
                  onSelectAvatar={setSelectedAvatarId}
                />
              </div>
            </CollapsiblePanel>
          </aside>
        ) : (
          <div className="relative w-0 shrink-0 self-stretch overflow-visible z-20">
            <CollapsiblePanel
              isCollapsed={isLeftSidebarCollapsed}
              onToggle={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
              direction="left"
            >
              <div />
            </CollapsiblePanel>
          </div>
        )}

        {/* Center: flex-1, vertical stack — main stage + fixed-height log strip */}
        <div className="flex flex-1 min-w-0 min-h-0 flex-col">
          <div className="flex flex-1 min-h-0 gap-4 p-4">
            <div
              className={`min-w-0 min-h-0 flex flex-col ${
                isPrimaryViewAvatar ? 'w-[32%] max-w-md' : 'flex-1'
              }`}
            >
              <WebcamPreview
                isPrimary={!isPrimaryViewAvatar}
                onSwapView={handleSwapView}
                onMountReady={setWebcamMount}
              />
            </div>
            <div
              className={`min-w-0 min-h-0 flex flex-col ${
                isPrimaryViewAvatar ? 'flex-1' : 'w-[32%] max-w-md'
              }`}
            >
              <AvatarDisplay
                isPrimary={isPrimaryViewAvatar}
                onSwapView={handleSwapView}
                onMountReady={setAvatarMount}
              />
            </div>
          </div>

          {!isBottomPanelCollapsed ? (
            <div
              className={`shrink-0 ${BOTTOM_LOG_H} border-t border-zinc-800 bg-zinc-950 px-4 pb-3 pt-0 flex flex-col min-h-0`}
            >
              <CollapsiblePanel
                isCollapsed={isBottomPanelCollapsed}
                onToggle={() => setIsBottomPanelCollapsed(!isBottomPanelCollapsed)}
                direction="bottom"
              >
                <div className="h-full min-h-0 flex flex-col overflow-hidden pt-2">
                  <LogPanel logText={runtime.logText} />
                </div>
              </CollapsiblePanel>
            </div>
          ) : (
            <div className="relative h-0 shrink-0 overflow-visible z-20">
              <CollapsiblePanel
                isCollapsed={isBottomPanelCollapsed}
                onToggle={() => setIsBottomPanelCollapsed(!isBottomPanelCollapsed)}
                direction="bottom"
              >
                <div />
              </CollapsiblePanel>
            </div>
          )}
        </div>

        {/* Right: fixed width, scroll inside motion text */}
        {!isRightSidebarCollapsed ? (
          <aside
            className={`${RIGHT_SIDEBAR_W} shrink-0 flex flex-col min-h-0 border-l border-zinc-800 bg-zinc-950`}
          >
            <CollapsiblePanel
              isCollapsed={isRightSidebarCollapsed}
              onToggle={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
              direction="right"
            >
              <div className="h-full min-h-0 flex flex-col overflow-hidden p-2">
                <MotionParameters motionText={runtime.motionText} />
              </div>
            </CollapsiblePanel>
          </aside>
        ) : (
          <div className="relative w-0 shrink-0 self-stretch overflow-visible z-20">
            <CollapsiblePanel
              isCollapsed={isRightSidebarCollapsed}
              onToggle={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
              direction="right"
            >
              <div />
            </CollapsiblePanel>
          </div>
        )}
      </div>
    </div>
  );
}
