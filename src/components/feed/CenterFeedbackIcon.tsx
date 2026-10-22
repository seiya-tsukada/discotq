import React from 'react';
import { Heart, Play, Pause } from 'lucide-react';

export type CenterIconType = 'play' | 'pause' | 'heart';

interface CenterFeedbackIconProps {
  type: CenterIconType;
}

// タップ時に中央へ一瞬表示する再生 / 一時停止 / いいねアイコン
export const CenterFeedbackIcon: React.FC<CenterFeedbackIconProps> = ({ type }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
      {type === 'heart' && (
        <div className="animate-ping duration-300">
          <Heart className="w-20 h-20 text-rose-500 fill-rose-500 drop-shadow-lg" />
        </div>
      )}
      {type === 'play' && (
        <div className="w-14 h-14 rounded-full bg-slate-900/80 backdrop-blur-md flex items-center justify-center text-white border border-slate-750">
          <Play className="w-6 h-6 fill-white ml-0.5" />
        </div>
      )}
      {type === 'pause' && (
        <div className="w-14 h-14 rounded-full bg-slate-900/80 backdrop-blur-md flex items-center justify-center text-white border border-slate-750">
          <Pause className="w-6 h-6 fill-white" />
        </div>
      )}
    </div>
  );
};
