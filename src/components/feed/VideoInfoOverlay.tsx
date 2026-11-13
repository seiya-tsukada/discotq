import React from 'react';
import { BadgeCheck, Clock } from 'lucide-react';
import type { FeedVideo } from '../../types/api';
import { formatDuration } from '../../lib/videoFile';

interface VideoInfoOverlayProps {
  video: FeedVideo;
}

// 画面下部: タイトル・説明・投稿元
export const VideoInfoOverlay: React.FC<VideoInfoOverlayProps> = ({ video }) => {
  return (
    <div
      className="absolute bottom-4 left-3 right-16 z-20 pointer-events-auto flex flex-col gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        {video.source === 'platform' ? (
          <span className="flex items-center gap-1 text-xs font-bold text-white">
            DiscoTQ 編集部
            <BadgeCheck className="w-4 h-4 text-blue-400" />
          </span>
        ) : (
          <span className="text-xs font-bold text-white">ユーザー投稿</span>
        )}
        {video.duration_sec !== null && (
          <span className="flex items-center gap-1 text-[10px] text-slate-300 bg-slate-900/80 border border-slate-700/60 px-1.5 py-0.5 rounded">
            <Clock className="w-3 h-3" />
            {formatDuration(video.duration_sec)}
          </span>
        )}
      </div>

      {(video.title || video.description) && (
        <div className="text-left">
          {video.title && <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{video.title}</p>}
          {video.description && (
            <p className="text-[11px] text-slate-300 mt-1 line-clamp-3 leading-relaxed whitespace-pre-line">
              {video.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
