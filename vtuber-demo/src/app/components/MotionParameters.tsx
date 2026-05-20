import { Sliders } from 'lucide-react';

interface MotionParametersProps {
  motionText: string;
}

export function MotionParameters({ motionText }: MotionParametersProps) {
  return (
    <div className="h-full flex flex-col bg-zinc-900 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-zinc-800 border-b border-zinc-700">
        <h3 className="text-sm text-zinc-100 flex items-center gap-2">
          <Sliders className="w-4 h-4" />
          Motion Parameters
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <pre className="text-[11px] leading-snug text-zinc-300 font-mono whitespace-pre-wrap m-0">
          {motionText}
        </pre>
      </div>
    </div>
  );
}
