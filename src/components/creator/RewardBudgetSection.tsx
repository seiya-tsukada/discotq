import React from 'react';
import { Coins } from 'lucide-react';
import { CreatorAdForm } from './useCreatorAdForm';

interface RewardBudgetSectionProps {
  form: CreatorAdForm;
}

export const RewardBudgetSection: React.FC<RewardBudgetSectionProps> = ({ form }) => {
  const { rewardPoints, setRewardPoints, budget, setBudget } = form;

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <Coins className="w-4 h-4 text-blue-400" />
        <span>4. リワード付与 & 配信予算設定</span>
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            1視聴あたり付与リワード: <span className="text-blue-400 font-bold">{rewardPoints} pt</span>
          </label>
          <input
            type="range"
            min="10"
            max="40"
            step="5"
            value={rewardPoints}
            onChange={(e) => setRewardPoints(Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            出稿予算: <span className="text-white font-bold">¥{budget.toLocaleString()}</span>
          </label>
          <input
            type="range"
            min={10000}
            max={200000}
            step={5000}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
