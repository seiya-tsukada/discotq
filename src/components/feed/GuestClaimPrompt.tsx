import React from 'react';
import { ArrowRight, Wallet } from 'lucide-react';

interface GuestClaimPromptProps {
  rewardPoints: number;
  onClaim: (e: React.MouseEvent) => void;
}

// Guest Reward Floating Banner (Modern Prompt)
export const GuestClaimPrompt: React.FC<GuestClaimPromptProps> = ({ rewardPoints, onClaim }) => {
  return (
    <div
      className="absolute top-28 right-3.5 left-3.5 z-25 pointer-events-auto animate-fadeIn"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-3 rounded-xl bg-slate-900/95 backdrop-blur-md border border-blue-500/40 shadow-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white">+{rewardPoints}pt がウォレットに待機中</span>
            </div>
            <p className="text-[11px] text-slate-400">ワンタップで確定し、ギフト券交換へ保存</p>
          </div>
        </div>

        <button
          onClick={onClaim}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
        >
          <span>受取る</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
