import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsiblePanelProps {
  isCollapsed: boolean;
  onToggle: () => void;
  direction: 'left' | 'right' | 'bottom';
  children: ReactNode;
}

export function CollapsiblePanel({
  isCollapsed,
  onToggle,
  direction,
  children,
}: CollapsiblePanelProps) {
  const positionClass =
    direction === 'left'
      ? 'absolute top-1/2 -translate-y-1/2 -right-3 z-10'
      : direction === 'right'
        ? 'absolute top-1/2 -translate-y-1/2 -left-3 z-10'
        : 'absolute -top-3 left-1/2 -translate-x-1/2 z-10';

  const getIcon = () => {
    if (direction === 'left') {
      return isCollapsed ? (
        <ChevronRight className="w-4 h-4" />
      ) : (
        <ChevronLeft className="w-4 h-4" />
      );
    }
    if (direction === 'right') {
      return isCollapsed ? (
        <ChevronLeft className="w-4 h-4" />
      ) : (
        <ChevronRight className="w-4 h-4" />
      );
    }
    return isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  return (
    <div className="relative h-full min-h-0 flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
        className={`${positionClass} bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-full p-1.5 shadow-lg transition-colors border border-zinc-600`}
      >
        {getIcon()}
      </button>
      {children}
    </div>
  );
}
