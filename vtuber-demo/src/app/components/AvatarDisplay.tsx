import { Maximize2 } from 'lucide-react';

interface AvatarDisplayProps {
  isPrimary: boolean;
  onSwapView: () => void;
  onMountReady: (el: HTMLElement | null) => void;
}

export function AvatarDisplay({
  isPrimary,
  onSwapView,
  onMountReady,
}: AvatarDisplayProps) {
  return (
    <div className="h-full min-h-0 flex flex-col bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800">
      <div className="shrink-0 flex items-center justify-between p-3 bg-zinc-800 border-b border-zinc-700">
        <h3 className="text-sm text-zinc-100 flex items-center gap-2">
          Avatar Display
          {isPrimary && (
            <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded">
              Primary
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={onSwapView}
          className="p-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-100 transition-colors"
          title="Swap primary/secondary view"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      <div
        ref={onMountReady}
        id="avatar-panel-root"
        className="flex-1 min-h-0 bg-zinc-950 relative overflow-hidden"
      />
    </div>
  );
}
