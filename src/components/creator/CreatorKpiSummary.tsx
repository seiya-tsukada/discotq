import React from 'react';
import { AdItem } from '../../types';

interface CreatorKpiSummaryProps {
  ads: AdItem[];
}

export const CreatorKpiSummary: React.FC<CreatorKpiSummaryProps> = ({ ads }) => {
  // Metrics for creator
  const totalImpressions = ads.reduce((acc, a) => acc + a.impressions, 0);
  const totalViews = ads.reduce((acc, a) => acc + a.views, 0);
  const totalClicks = ads.reduce((acc, a) => acc + a.clicks, 0);
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
        <span className="text-xs text-slate-400 font-medium">総配信インプレッション</span>
        <p className="text-2xl font-bold text-white mt-1">{totalImpressions.toLocaleString()}</p>
        <span className="text-[10px] text-emerald-400 font-medium mt-1 inline-block">同業種平均 +18.2%</span>
      </div>
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
        <span className="text-xs text-slate-400 font-medium">完全視聴数 (5秒以上)</span>
        <p className="text-2xl font-bold text-blue-400 mt-1">{totalViews.toLocaleString()}</p>
        <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">平均維持率: 68.4%</span>
      </div>
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
        <span className="text-xs text-slate-400 font-medium">公式LP遷移数</span>
        <p className="text-2xl font-bold text-slate-100 mt-1">{totalClicks.toLocaleString()}</p>
        <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">平均CTR: {avgCtr}%</span>
      </div>
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
        <span className="text-xs text-slate-400 font-medium">登録済みクリエイティブ</span>
        <p className="text-2xl font-bold text-emerald-400 mt-1">{ads.length} 本</p>
        <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">
          承認済み: {ads.filter((a) => a.reviewStatus === 'approved').length} 本
        </span>
      </div>
    </div>
  );
};
