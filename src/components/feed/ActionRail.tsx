import React from 'react';
import { Heart, MessageSquare, Bookmark, Share2 } from 'lucide-react';
import type { FeedVideo } from '../../types/api';
import { useApp } from '../../context/AppContext';

interface ActionRailProps {
  video: FeedVideo;
  isLiked: boolean;
  isBookmarked: boolean;
}

const baseButton =
  'w-9 h-9 rounded-lg flex items-center justify-center transition-all bg-slate-900/80 backdrop-blur-sm text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800';

// 右側: いいね・コメント・保存・共有
export const ActionRail: React.FC<ActionRailProps> = ({ video, isLiked, isBookmarked }) => {
  const { toggleLike, toggleBookmark, comments, setIsCommentsModalOpen, setIsShareModalOpen } = useApp();
  const commentCount = comments[video.id]?.length ?? 0;

  return (
    <div
      className="absolute right-3.5 bottom-24 z-20 flex flex-col items-center gap-3 pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col items-center">
        <button
          onClick={() => toggleLike(video.id)}
          className={
            isLiked
              ? 'w-9 h-9 rounded-lg flex items-center justify-center transition-all bg-rose-500/15 text-rose-400 border border-rose-500/30'
              : baseButton
          }
          title="いいね"
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>
        <span className="text-[10px] font-medium text-slate-300 mt-1">いいね</span>
      </div>

      <div className="flex flex-col items-center">
        <button onClick={() => setIsCommentsModalOpen(true)} className={baseButton} title="コメント">
          <MessageSquare className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-medium text-slate-300 mt-1">{commentCount}</span>
      </div>

      <div className="flex flex-col items-center">
        <button
          onClick={() => toggleBookmark(video.id)}
          className={
            isBookmarked
              ? 'w-9 h-9 rounded-lg flex items-center justify-center transition-all bg-blue-500/15 text-blue-400 border border-blue-500/30'
              : baseButton
          }
          title="保存"
        >
          <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-blue-400 text-blue-400' : ''}`} />
        </button>
        <span className="text-[10px] font-medium text-slate-300 mt-1">保存</span>
      </div>

      <div className="flex flex-col items-center">
        <button onClick={() => setIsShareModalOpen(true)} className={baseButton} title="共有">
          <Share2 className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-medium text-slate-300 mt-1">共有</span>
      </div>
    </div>
  );
};
