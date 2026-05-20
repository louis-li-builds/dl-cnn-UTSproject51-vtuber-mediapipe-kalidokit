import { Sliders } from 'lucide-react';

interface MotionParametersProps {
  motionText: string;
}

export function MotionParameters({ motionText }: MotionParametersProps) {
  return (
    <div className="h-full min-h-0 flex flex-col bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800">
      <div className="shrink-0 flex items-center justify-between p-3 bg-zinc-800 border-b border-zinc-700">
        <h3 className="text-sm text-zinc-100 flex items-center gap-2">
          <Sliders className="w-4 h-4" />
          Motion Parameters
        </h3>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-3 [scrollbar-width:thin] [scrollbar-color:#52525b_#09090b]">
        <pre className="text-[11px] leading-snug text-zinc-300 font-mono whitespace-pre-wrap m-0">
          {motionText}
        </pre>
      </div>
    </div>
  );
}
