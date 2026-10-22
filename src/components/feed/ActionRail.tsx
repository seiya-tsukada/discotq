import React from 'react';
import { Heart, MessageSquare, Bookmark, Share2, FileText } from 'lucide-react';
import { AdItem } from '../../types';
import { useApp } from '../../context/AppContext';

interface ActionRailProps {
  ad: AdItem;
  isLiked: boolean;
  isBookmarked: boolean;
}

// Right Sidebar: Interaction Actions
export const ActionRail: React.FC<ActionRailProps> = ({ ad, isLiked, isBookmarked }) => {
  const { toggleLikeAd, toggleBookmarkAd, openLpModal, setIsCommentsModalOpen, setIsShareModalOpen } = useApp();

  return (
    <div
      className="absolute right-3.5 bottom-24 z-20 flex flex-col items-center gap-3 pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Brand Profile Avatar */}
      <div className="relative group">
        <button
          onClick={() => openLpModal(ad)}
          className="w-10 h-10 rounded-lg p-0.5 bg-slate-800 border border-slate-700 hover:border-blue-500 transition-all shadow"
          title="公式詳細を見る"
        >
          <img
            src={ad.brandLogo}
            alt={ad.brandName}
            className="w-full h-full rounded-[6px] object-cover bg-slate-900"
          />
        </button>
      </div>

      {/* Like Button */}
      <div className="flex flex-col items-center">
        <button
          onClick={() => toggleLikeAd(ad.id)}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            isLiked
              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              : 'bg-slate-900/80 backdrop-blur-sm text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800'
          }`}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>
        <span className="text-[10px] font-medium text-slate-300 mt-1">{ad.likesCount.toLocaleString()}</span>
      </div>

      {/* Comment Button */}
      <div className="flex flex-col items-center">
        <button
          onClick={() => setIsCommentsModalOpen(true)}
          className="w-9 h-9 rounded-lg bg-slate-900/80 backdrop-blur-sm text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800 flex items-center justify-center transition-all"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-medium text-slate-300 mt-1">{ad.commentsCount.toLocaleString()}</span>
      </div>

      {/* Bookmark Button */}
      <div className="flex flex-col items-center">
        <button
          onClick={() => toggleBookmarkAd(ad.id)}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            isBookmarked
              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
              : 'bg-slate-900/80 backdrop-blur-sm text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800'
          }`}
        >
          <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-blue-400 text-blue-400' : ''}`} />
        </button>
        <span className="text-[10px] font-medium text-slate-300 mt-1">保存</span>
      </div>

      {/* Share Button */}
      <div className="flex flex-col items-center">
        <button
          onClick={() => setIsShareModalOpen(true)}
          className="w-9 h-9 rounded-lg bg-slate-900/80 backdrop-blur-sm text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800 flex items-center justify-center transition-all"
        >
          <Share2 className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-medium text-slate-300 mt-1">共有</span>
      </div>

      {/* LP Shortcut Icon */}
      <div className="flex flex-col items-center">
        <button
          onClick={() => openLpModal(ad)}
          className="w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-md transition-all"
          title="公式LP・サービス詳細"
        >
          <FileText className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-medium text-blue-400 mt-1">詳細</span>
      </div>
    </div>
  );
};
