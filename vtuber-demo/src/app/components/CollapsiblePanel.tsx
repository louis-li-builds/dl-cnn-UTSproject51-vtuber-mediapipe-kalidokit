import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsiblePanelProps {
  isCollapsed: boolean;
  onToggle: () => void;
  direction: 'left' | 'right' | 'bottom';
  children: ReactNode;
}

export function CollapsiblePanel({ isCollapsed, onToggle, direction, children }: CollapsiblePanelProps) {
  const getButtonPosition = () => {
    switch (direction) {
      case 'left':
        return 'absolute top-1/2 -translate-y-1/2 -right-3 z-10';
      case 'right':
        return 'absolute top-1/2 -translate-y-1/2 -left-3 z-10';
      case 'bottom':
        return 'absolute -top-3 left-1/2 -translate-x-1/2 z-10';
    }
  };

  const getIcon = () => {
    if (direction === 'left') {
      return isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />;
    } else if (direction === 'right') {
      return isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />;
    } else {
      return isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
    }
  };

  return (
    <div className="relative h-full">
      <button
        onClick={onToggle}
        className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-full p-1.5 shadow-lg transition-colors"
        style={{ position: 'absolute', ...getPositionStyles(getButtonPosition()) }}
      >
        {getIcon()}
      </button>
      {children}
    </div>
  );
}

function getPositionStyles(className: string) {
  const styles: Record<string, string> = {};

  if (className.includes('top-1/2')) {
    styles.top = '50%';
  }
  if (className.includes('-translate-y-1/2')) {
    styles.transform = 'translateY(-50%)';
  }
  if (className.includes('-right-3')) {
    styles.right = '-0.75rem';
  }
  if (className.includes('-left-3')) {
    styles.left = '-0.75rem';
  }
  if (className.includes('-top-3')) {
    styles.top = '-0.75rem';
  }
  if (className.includes('left-1/2')) {
    styles.left = '50%';
  }
  if (className.includes('-translate-x-1/2')) {
    styles.transform = 'translateX(-50%)';
  }

  return styles;
}
