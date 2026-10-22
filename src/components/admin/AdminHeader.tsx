import React from 'react';
import { ShieldCheck, Users, Layers, Clock } from 'lucide-react';

export type AdminTab = 'moderation' | 'creators' | 'allAds';

interface AdminHeaderProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  pendingCount: number;
  creatorsCount: number;
  adsCount: number;
}

// Top Header（タイトル＋タブ切替）
export const AdminHeader: React.FC<AdminHeaderProps> = ({
  activeTab,
  onTabChange,
  pendingCount,
  creatorsCount,
  adsCount,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 py-3.5 sticky top-0 z-30 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-base">DiscoTQ Platform Admin</span>
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              /admin
            </span>
          </div>
          <p className="text-[11px] text-slate-400">プラットフォーム運営者向け 広告審査＆クリエイター統合管理</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
        <button
          onClick={() => onTabChange('moderation')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'moderation'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>広告審査キュー</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-slate-950 font-bold">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onTabChange('creators')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'creators'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>全クリエイター一覧 ({creatorsCount})</span>
        </button>
        <button
          onClick={() => onTabChange('allAds')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'allAds'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>全広告カタログ ({adsCount})</span>
        </button>
      </div>
    </header>
  );
};
