import React from 'react';
import { BadgeCheck } from 'lucide-react';
import { CreatorAccount } from '../../types';

interface CreatorsTableProps {
  creators: CreatorAccount[];
}

// Tab 2: All Creators Directory
export const CreatorsTable: React.FC<CreatorsTableProps> = ({ creators }) => {
  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">全クリエイター・広告主ディレクトリ</h2>
          <p className="text-xs text-slate-400">プラットフォーム参加企業の一覧と健全性モニタリング</p>
        </div>
        <span className="text-xs text-slate-400">計 {creators.length} 社</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="p-3">クリエイター・企業</th>
              <th className="p-3">アカウントランク</th>
              <th className="p-3">出稿本数</th>
              <th className="p-3">累計広告費</th>
              <th className="p-3">平均CTR</th>
              <th className="p-3">平均完走率</th>
              <th className="p-3">ステータス</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {creators.map((c) => (
              <tr key={c.id} className="hover:bg-slate-850/50 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={c.avatar}
                      alt={c.name}
                      className="w-9 h-9 rounded-lg object-cover bg-slate-950 border border-slate-800 shrink-0"
                    />
                    <div>
                      <p className="font-bold text-white">{c.companyName}</p>
                      <p className="text-[11px] text-slate-400">
                        {c.name} ({c.email})
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {c.tier}
                  </span>
                </td>
                <td className="p-3 font-semibold text-white">{c.totalAdsCreated} 本</td>
                <td className="p-3 font-bold text-slate-200">¥{c.totalBudgetSpent.toLocaleString()}</td>
                <td className="p-3 font-semibold text-emerald-400">{c.averageCtr}%</td>
                <td className="p-3 font-semibold text-blue-400">{c.averageViewRate}%</td>
                <td className="p-3">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-max">
                    <BadgeCheck className="w-3 h-3" />
                    アクティブ
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
