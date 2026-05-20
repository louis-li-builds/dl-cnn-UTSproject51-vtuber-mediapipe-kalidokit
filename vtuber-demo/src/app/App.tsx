import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { AvatarSelector } from './components/AvatarSelector';
import { WebcamPreview } from './components/WebcamPreview';
import { AvatarDisplay } from './components/AvatarDisplay';
import { MotionParameters } from './components/MotionParameters';
import { LogPanel } from './components/LogPanel';
import { AppHeader } from './components/AppHeader';
import { CollapsiblePanel } from './components/CollapsiblePanel';
import { useVtuberPipeline } from './hooks/useVtuberPipeline';
import { useRuntimeStore } from './hooks/useRuntimeStore';

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

      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          {!isLeftSidebarCollapsed && (
            <>
              <Panel defaultSize={15} minSize={10} maxSize={25}>
                <CollapsiblePanel
                  isCollapsed={isLeftSidebarCollapsed}
                  onToggle={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
                  direction="left"
                >
                  <AvatarSelector
                    selectedAvatarId={selectedAvatarId}
                    onSelectAvatar={setSelectedAvatarId}
                  />
                </CollapsiblePanel>
              </Panel>
              <PanelResizeHandle className="w-1 bg-zinc-800 hover:bg-zinc-700 transition-colors" />
            </>
          )}

          {isLeftSidebarCollapsed && (
            <div className="relative w-0">
              <CollapsiblePanel
                isCollapsed={isLeftSidebarCollapsed}
                onToggle={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
                direction="left"
              >
                <div />
              </CollapsiblePanel>
            </div>
          )}

          <Panel minSize={40}>
            <PanelGroup direction="vertical">
              <Panel defaultSize={70} minSize={40}>
                <div className="h-full p-4">
                  <div className="h-full flex gap-4">
                    <div className={isPrimaryViewAvatar ? 'w-1/3' : 'flex-1'}>
                      <WebcamPreview
                        isPrimary={!isPrimaryViewAvatar}
                        onSwapView={handleSwapView}
                        onMountReady={setWebcamMount}
                      />
                    </div>
                    <div className={isPrimaryViewAvatar ? 'flex-1' : 'w-1/3'}>
                      <AvatarDisplay
                        isPrimary={isPrimaryViewAvatar}
                        onSwapView={handleSwapView}
                        onMountReady={setAvatarMount}
                      />
                    </div>
                  </div>
                </div>
              </Panel>

              {!isBottomPanelCollapsed && (
                <>
                  <PanelResizeHandle className="h-1 bg-zinc-800 hover:bg-zinc-700 transition-colors" />
                  <Panel defaultSize={30} minSize={15} maxSize={50}>
                    <div className="h-full px-4 pb-4">
                      <CollapsiblePanel
                        isCollapsed={isBottomPanelCollapsed}
                        onToggle={() => setIsBottomPanelCollapsed(!isBottomPanelCollapsed)}
                        direction="bottom"
                      >
                        <LogPanel logText={runtime.logText} />
                      </CollapsiblePanel>
                    </div>
                  </Panel>
                </>
              )}

              {isBottomPanelCollapsed && (
                <div className="relative h-0">
                  <CollapsiblePanel
                    isCollapsed={isBottomPanelCollapsed}
                    onToggle={() => setIsBottomPanelCollapsed(!isBottomPanelCollapsed)}
                    direction="bottom"
                  >
                    <div />
                  </CollapsiblePanel>
                </div>
              )}
            </PanelGroup>
          </Panel>

          {!isRightSidebarCollapsed && (
            <>
              <PanelResizeHandle className="w-1 bg-zinc-800 hover:bg-zinc-700 transition-colors" />
              <Panel defaultSize={20} minSize={15} maxSize={30}>
                <CollapsiblePanel
                  isCollapsed={isRightSidebarCollapsed}
                  onToggle={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
                  direction="right"
                >
                  <MotionParameters motionText={runtime.motionText} />
                </CollapsiblePanel>
              </Panel>
            </>
          )}

          {isRightSidebarCollapsed && (
            <div className="relative w-0">
              <CollapsiblePanel
                isCollapsed={isRightSidebarCollapsed}
                onToggle={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
                direction="right"
              >
                <div />
              </CollapsiblePanel>
            </div>
          )}
        </PanelGroup>
      </div>
    </div>
  );
}
