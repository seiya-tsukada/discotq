import React from 'react';
import { Upload } from 'lucide-react';
import { AdItem } from '../../types';
import { CreatorAdListItem } from './CreatorAdListItem';

interface CreatorAdListProps {
  ads: AdItem[];
  onUploadClick: () => void;
  onToggleStatus: (adId: string) => void;
  onDelete: (adId: string) => void;
}

export const CreatorAdList: React.FC<CreatorAdListProps> = ({ ads, onUploadClick, onToggleStatus, onDelete }) => {
  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">入稿・出店中のショート広告一覧</h2>
          <p className="text-xs text-slate-400">配信設定、LP編集、審査ステータスの確認</p>
        </div>
        <button
          onClick={onUploadClick}
          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>新規入稿</span>
        </button>
      </div>

      <div className="grid gap-3">
        {ads.map((ad) => (
          <CreatorAdListItem key={ad.id} ad={ad} onToggleStatus={onToggleStatus} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
};
