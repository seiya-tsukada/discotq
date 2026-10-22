import React from 'react';
import { AdItem } from '../../types';

interface PlatformMetricsProps {
  ads: AdItem[];
  pendingCount: number;
  creatorsCount: number;
}

// Platform Overview Metrics
export const PlatformMetrics: React.FC<PlatformMetricsProps> = ({ ads, pendingCount, creatorsCount }) => {
  const totalBudgetSpent = ads.reduce((acc, a) => acc + a.budgetSpent, 0);
  const totalImpressions = ads.reduce((acc, a) => acc + a.impressions, 0);
  const totalViews = ads.reduce((acc, a) => acc + a.views, 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
        <span className="text-xs text-slate-400 font-medium">審査待ちキュー</span>
        <p className="text-2xl font-bold text-amber-400 mt-1">{pendingCount} 件</p>
        <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">平均審査時間: 4分</span>
      </div>
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
        <span className="text-xs text-slate-400 font-medium">登録広告主・クリエイター</span>
        <p className="text-2xl font-bold text-white mt-1">{creatorsCount} 社</p>
        <span className="text-[10px] text-emerald-400 font-medium mt-1 inline-block">公認・審査済み</span>
      </div>
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
        <span className="text-xs text-slate-400 font-medium">プラットフォーム総インプレッション</span>
        <p className="text-2xl font-bold text-blue-400 mt-1">{totalImpressions.toLocaleString()}</p>
        <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">
          完全視聴: {totalViews.toLocaleString()}
        </span>
      </div>
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
        <span className="text-xs text-slate-400 font-medium">累計流通広告費</span>
        <p className="text-2xl font-bold text-slate-100 mt-1">¥{totalBudgetSpent.toLocaleString()}</p>
        <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">リワード還元実行済み</span>
      </div>
    </div>
  );
};
