import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import type { VideoSource } from '../../types/api';

interface CardTopBarProps {
  source: VideoSource;
  isMuted: boolean;
  onToggleSound: (e: React.MouseEvent) => void;
}

const SOURCE_LABELS: Record<VideoSource, string> = {
  platform: '運営ピックアップ',
  user: 'みんなの投稿',
};

// 上部: 投稿元ラベルと音声切替
export const CardTopBar: React.FC<CardTopBarProps> = ({ source, isMuted, onToggleSound }) => {
  return (
    <div className="absolute top-3.5 left-3.5 right-3.5 z-20 flex items-center justify-between pointer-events-auto">
      <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-full px-2.5 py-1 text-[11px] text-slate-300">
        <span className={`w-1.5 h-1.5 rounded-full ${source === 'platform' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
        <span className="font-medium text-slate-300">{SOURCE_LABELS[source]}</span>
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
