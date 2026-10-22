import React from 'react';
import { Check, Sparkles } from 'lucide-react';

const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface WatchRewardRingProps {
  rewardPoints: number;
  minWatchSeconds: number;
  watchSeconds: number;
  hasCompletedWatch: boolean;
  isClaimed: boolean;
  onClaim: (e: React.MouseEvent) => void;
}

// Upper Right: Circular Ring with Label on the LEFT
export const WatchRewardRing: React.FC<WatchRewardRingProps> = ({
  rewardPoints,
  minWatchSeconds,
  watchSeconds,
  hasCompletedWatch,
  isClaimed,
  onClaim,
}) => {
  // Ring progress calculations
  const progressRatio = Math.min(1, watchSeconds / minWatchSeconds);
  const strokeDashoffset = RING_CIRCUMFERENCE - progressRatio * RING_CIRCUMFERENCE;
  const remainingSeconds = Math.max(0, Math.ceil(minWatchSeconds - watchSeconds));

  return (
    <div
      className="absolute top-14 right-3.5 z-25 pointer-events-auto flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Label to the LEFT of the ring */}
      <div className="text-right">
        {isClaimed ? (
          <div className="bg-slate-900/85 backdrop-blur-md border border-slate-800 px-2.5 py-1 rounded-lg">
            <p className="text-[10px] text-slate-400 leading-none">受取完了</p>
            <p className="text-xs font-bold text-emerald-400 leading-tight">+{rewardPoints}pt</p>
          </div>
        ) : hasCompletedWatch ? (
          <div className="bg-blue-900/85 backdrop-blur-md border border-blue-400 px-2.5 py-1 rounded-lg shadow-sm">
            <p className="text-[10px] text-blue-200 font-semibold leading-none">タップして受取</p>
            <p className="text-xs font-black text-white leading-tight">CLAIM +{rewardPoints}pt</p>
          </div>
        ) : (
          <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800 px-2.5 py-1 rounded-lg">
            <p className="text-[10px] text-slate-400 leading-none">視聴で受取</p>
            <p className="text-xs font-semibold text-blue-400 leading-tight">+{rewardPoints}pt</p>
          </div>
        )}
      </div>

      {/* Circular SVG Ring Widget */}
      <button
        onClick={onClaim}
        disabled={!hasCompletedWatch && !isClaimed}
        className={`relative flex items-center justify-center w-11 h-11 rounded-full backdrop-blur-md transition-all duration-300 border ${
          isClaimed
            ? 'bg-slate-900/90 border-emerald-500/30 text-emerald-400 shadow-sm'
            : hasCompletedWatch
              ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/30 scale-105 cursor-pointer ring-2 ring-blue-400/40'
              : 'bg-slate-950/80 border-slate-800 text-slate-300 shadow'
        }`}
        title={isClaimed ? 'リワード獲得済み' : hasCompletedWatch ? 'タップしてリワードを受け取る' : '動画視聴進行中'}
      >
        <svg className="w-10 h-10 -rotate-90 transform" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r={RING_RADIUS} className="stroke-slate-800 fill-none" strokeWidth="3.5" />
          <circle
            cx="24"
            cy="24"
            r={RING_RADIUS}
            className={`fill-none transition-all duration-150 ${
              isClaimed ? 'stroke-emerald-400' : hasCompletedWatch ? 'stroke-white' : 'stroke-blue-500'
            }`}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={hasCompletedWatch ? 0 : strokeDashoffset}
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center text-center">
          {isClaimed ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : hasCompletedWatch ? (
            <Sparkles className="w-4 h-4 text-white" />
          ) : (
            <span className="text-[10px] font-mono font-bold text-slate-200">{remainingSeconds}s</span>
          )}
        </div>
      </button>
    </div>
  );
};
