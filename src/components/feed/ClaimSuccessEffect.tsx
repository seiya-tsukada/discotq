import React from 'react';
import { Coins } from 'lucide-react';

interface ClaimSuccessEffectProps {
  rewardPoints: number;
}

// Exclusive Claim Success Effect (Only shown right after claiming)
export const ClaimSuccessEffect: React.FC<ClaimSuccessEffectProps> = ({ rewardPoints }) => {
  return (
    <div className="absolute top-16 right-4 z-35 pointer-events-none animate-fadeIn">
      <div className="px-3 py-1.5 rounded-full bg-emerald-500/95 text-white shadow-xl shadow-emerald-500/30 flex items-center gap-1.5 text-xs font-bold transform -translate-y-2 transition-all">
        <Coins className="w-4 h-4 text-emerald-100 animate-spin" />
        <span>+{rewardPoints}pt 獲得！</span>
      </div>
    </div>
  );
};
