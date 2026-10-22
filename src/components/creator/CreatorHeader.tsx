import React from 'react';
import { Upload } from 'lucide-react';

export type CreatorTab = 'dashboard' | 'upload' | 'analytics';

interface CreatorHeaderProps {
  activeTab: CreatorTab;
  onTabChange: (tab: CreatorTab) => void;
}

export const CreatorHeader: React.FC<CreatorHeaderProps> = ({ activeTab, onTabChange }) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 py-3.5 sticky top-0 z-30 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm">
          Ad
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-base">DiscoTQ Creator Studio</span>
            <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
              /creator
            </span>
          </div>
          <p className="text-[11px] text-slate-400">広告配信者・クリエイター向け運用管理ポータル</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
        <button
          onClick={() => onTabChange('dashboard')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          ダッシュボード & 改善
        </button>
        <button
          onClick={() => onTabChange('upload')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'upload' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>新規広告アップロード</span>
        </button>
      </div>
    </header>
  );
};
