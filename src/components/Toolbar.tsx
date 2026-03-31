import React from 'react';
import { CircleDot, MousePointer2 } from 'lucide-react';

interface ToolbarProps {
  isPicking: boolean;
  onTogglePicking: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ isPicking, onTogglePicking }) => {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-2xl border border-gray-200">
      <button
        onClick={onTogglePicking}
        className={`p-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
          isPicking 
            ? 'bg-blue-600 text-white shadow-inner' 
            : 'hover:bg-gray-100 text-gray-700'
        }`}
        title={isPicking ? "Cancel Picking" : "Add Range Circles"}
      >
        {isPicking ? <MousePointer2 size={20} /> : <CircleDot size={20} />}
        <span className="text-sm font-medium pr-1">
          {isPicking ? "Click on Map" : "Add Circles"}
        </span>
      </button>
    </div>
  );
};

export default Toolbar;
