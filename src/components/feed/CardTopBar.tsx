import React from 'react';
import { Clock, Star, Volume2, VolumeX } from 'lucide-react';
import { formatDuration } from '../../lib/videoFile';
import { uploaderDisplayName } from '../../lib/uploader';
import type { FeedVideo } from '../../types/api';

interface CardTopBarProps {
  video: FeedVideo;
  isMuted: boolean;
  onToggleSound: (e: React.MouseEvent) => void;
}

// 上部: 左に投稿者・ピックアップ・タイトル・説明、右に音声切替
export const CardTopBar: React.FC<CardTopBarProps> = ({ video, isMuted, onToggleSound }) => {
  const name = uploaderDisplayName(video);
  const isPlatform = video.source === 'platform';

  return (
    <>
      <div
        className="absolute top-3.5 left-3.5 right-14 z-20 flex flex-col gap-1.5 pointer-events-auto text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
              isPlatform ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-100'
            }`}
            aria-hidden="true"
          >
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="text-xs font-bold text-white truncate max-w-[10rem] drop-shadow">{name}</span>
          {video.is_pickup && (
            <span className="flex items-center gap-0.5 rounded-full bg-amber-400 text-amber-950 px-2 py-0.5 text-[10px] font-bold shadow-sm">
              <Star className="w-3 h-3 fill-current" />
              ピックアップ
            </span>
          )}
          {video.duration_sec !== null && (
            <span className="flex items-center gap-1 text-[10px] text-slate-300 bg-slate-900/80 border border-slate-700/60 px-1.5 py-0.5 rounded">
              <Clock className="w-3 h-3" />
              {formatDuration(video.duration_sec)}
            </span>
          )}
        </div>

        {/* 右上の視聴ポイントのリングと重ならないよう、本文は幅を詰める */}
        {(video.title || video.description) && (
          <div className="pr-32">
            {video.title && (
              <p className="text-sm font-semibold text-white leading-snug line-clamp-2 drop-shadow">{video.title}</p>
            )}
            {video.description && (
              <p className="text-[11px] text-slate-200 mt-0.5 line-clamp-2 leading-relaxed whitespace-pre-line drop-shadow">
                {video.description}
              </p>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onToggleSound}
        className="absolute top-3.5 right-3.5 z-20 p-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer pointer-events-auto"
        title={isMuted ? '音声オン' : '音声ミュート'}
      >
        {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
      </button>
    </>
  );
};
