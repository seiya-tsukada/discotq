import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, Trash2, Play, Pause } from 'lucide-react';
import { AdItem } from '../../types';

interface CreatorAdListItemProps {
  ad: AdItem;
  onToggleStatus: (adId: string) => void;
  onDelete: (adId: string) => void;
}

export const CreatorAdListItem: React.FC<CreatorAdListItemProps> = ({ ad, onToggleStatus, onDelete }) => {
  return (
    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Left: Thumbnail & Info */}
      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
        <div className="relative w-14 h-20 rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-slate-800">
          <img src={ad.posterUrl} alt={ad.title} className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-200 truncate">{ad.brandName}</span>
            <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
              {ad.category}
            </span>

            {/* Review Badge */}
            {ad.reviewStatus === 'approved' ? (
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                審査承認済
              </span>
            ) : ad.reviewStatus === 'pending' ? (
              <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                審査中
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                要修正・差戻し
              </span>
            )}
          </div>

          <h3 className="text-sm font-semibold text-white leading-snug line-clamp-1">{ad.title}</h3>
          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
            CTA: 「{ad.ctaText}」 → LP: {ad.landingPage.externalUrl}
          </p>

          {ad.reviewFeedback && (
            <p className="text-[11px] text-slate-500 mt-1 italic">※ 審査コメント: {ad.reviewFeedback}</p>
          )}
        </div>
      </div>

      {/* Middle: Performance */}
      <div className="flex items-center gap-6 text-xs text-slate-300 pl-0 md:pl-4 border-t md:border-t-0 md:border-l border-slate-850 pt-2 md:pt-0">
        <div>
          <span className="text-[10px] text-slate-500 block">視聴数</span>
          <span className="font-bold text-white">{ad.views.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 block">LPクリック</span>
          <span className="font-bold text-blue-400">{ad.clicks.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 block">リワード付与</span>
          <span className="font-bold text-slate-200">{ad.rewardPoints} pt</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 self-end md:self-center">
        <button
          onClick={() => onToggleStatus(ad.id)}
          className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
            ad.status === 'active'
              ? 'bg-slate-850 hover:bg-slate-800 text-slate-300'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
          title={ad.status === 'active' ? '配信停止' : '配信開始'}
        >
          {ad.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={() => onDelete(ad.id)}
          className="p-2 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer border border-slate-800"
          title="広告を削除"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
