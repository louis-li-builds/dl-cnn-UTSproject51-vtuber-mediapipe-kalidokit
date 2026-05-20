import { Sparkles, Wifi, WifiOff, Activity } from 'lucide-react';

interface AppHeaderProps {
  isConnected: boolean;
  status: string;
  fps: number;
}

export function AppHeader({ isConnected, status, fps }: AppHeaderProps) {
  return (
    <div className="h-14 bg-zinc-900 border-b border-zinc-700 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <Sparkles className="w-6 h-6 text-purple-500" />
        <h1 className="text-zinc-100">VTuber Studio</h1>
        <span className="text-xs text-zinc-500">Figma UI + live pipeline</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-md">
          {isConnected ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
          <span className="text-xs text-zinc-300">{status}</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-md">
          <Activity className="w-4 h-4 text-blue-500" />
          <span className="text-xs text-zinc-300">{fps} FPS</span>
        </div>
      </div>
    </div>
  );
}
