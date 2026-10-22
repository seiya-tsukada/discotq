import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { AdCategory } from '../../types';

interface CardTopBarProps {
  category: AdCategory;
  isMuted: boolean;
  onToggleSound: (e: React.MouseEvent) => void;
}

// Top Header: Category Tag & Sound Controls
export const CardTopBar: React.FC<CardTopBarProps> = ({ category, isMuted, onToggleSound }) => {
  return (
    <div className="absolute top-3.5 left-3.5 right-3.5 z-20 flex items-center justify-between pointer-events-auto">
      <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-full px-2.5 py-1 text-[11px] text-slate-300">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        <span className="font-medium text-slate-300">スポンサー</span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400">{category}</span>
      </div>

      <button
        onClick={onToggleSound}
        className="p-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
        title={isMuted ? '音声オン' : '音声ミュート'}
      >
        {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
      </button>
    </div>
  );
};
