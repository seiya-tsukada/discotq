import React from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { AdItem } from '../../types';

interface CreativeImprovementPanelProps {
  ads: AdItem[];
  onUploadClick: () => void;
}

export const CreativeImprovementPanel: React.FC<CreativeImprovementPanelProps> = ({ ads, onUploadClick }) => {
  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">クリエイティブ改善ダッシュボード</h2>
            <p className="text-xs text-slate-400">データ分析に基づく離脱防止・CVR最大化の改善アドバイス</p>
          </div>
        </div>
      </div>

      {/* Optimization Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ads[0]?.optimization?.suggestedImprovements?.map((tip, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                  {tip.type.toUpperCase()} 改善提案
                </span>
                <span className="text-xs font-bold text-emerald-400">想定効果: {tip.expectedLift}</span>
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-white mb-1">{tip.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{tip.description}</p>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-850 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">対象: {ads[0].title}</span>
              <button
                onClick={onUploadClick}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
              >
                <span>改善版をアップロード</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
