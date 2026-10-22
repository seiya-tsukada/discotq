import React from 'react';
import { useApp } from '../../context/AppContext';
import { AdItem } from '../../types';

interface AllAdsTableProps {
  ads: AdItem[];
}

// Tab 3: All Ads Catalog
export const AllAdsTable: React.FC<AllAdsTableProps> = ({ ads }) => {
  const { toggleAdStatus } = useApp();

  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">全ショート広告カタログ</h2>
          <p className="text-xs text-slate-400">プラットフォーム全体の配信ステータスと強制停止コントロール</p>
        </div>
        <span className="text-xs text-slate-400">計 {ads.length} 本</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="p-3">広告</th>
              <th className="p-3">審査状態</th>
              <th className="p-3">配信状態</th>
              <th className="p-3">視聴回数</th>
              <th className="p-3">LPクリック</th>
              <th className="p-3">消費予算</th>
              <th className="p-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {ads.map((ad) => (
              <tr key={ad.id} className="hover:bg-slate-850/50 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={ad.posterUrl}
                      alt={ad.title}
                      className="w-10 h-14 rounded-md object-cover bg-slate-950 shrink-0"
                    />
                    <div className="max-w-[220px]">
                      <p className="font-semibold text-white truncate">{ad.title}</p>
                      <p className="text-[11px] text-slate-400">
                        @{ad.brandName}・{ad.category}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                      ad.reviewStatus === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : ad.reviewStatus === 'pending'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {ad.reviewStatus === 'approved' ? '承認済' : ad.reviewStatus === 'pending' ? '審査中' : '差戻し'}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      ad.status === 'active' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {ad.status === 'active' ? '配信中' : '停止中'}
                  </span>
                </td>
                <td className="p-3 font-semibold text-white">{ad.views.toLocaleString()}</td>
                <td className="p-3 font-semibold text-blue-400">{ad.clicks.toLocaleString()}</td>
                <td className="p-3 font-semibold text-slate-200">¥{ad.budgetSpent.toLocaleString()}</td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => toggleAdStatus(ad.id)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    {ad.status === 'active' ? '強制一時停止' : '再開'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
