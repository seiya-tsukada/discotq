import React from 'react';
import { ExternalLink, Music, BadgeCheck } from 'lucide-react';
import { AdItem } from '../../types';
import { useApp } from '../../context/AppContext';

interface AdInfoOverlayProps {
  ad: AdItem;
}

// Bottom Information & CTA Section
export const AdInfoOverlay: React.FC<AdInfoOverlayProps> = ({ ad }) => {
  const { openLpModal } = useApp();

  return (
    <div
      className="absolute bottom-3 left-3 right-16 z-20 pointer-events-auto flex flex-col gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Brand & Verified badge */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => openLpModal(ad)}
          className="flex items-center gap-1.5 hover:underline group cursor-pointer"
        >
          <span className="font-bold text-sm text-white">{ad.brandName}</span>
          {ad.verified && (
            <span title="認証済み企業">
              <BadgeCheck className="w-4 h-4 text-blue-400" />
            </span>
          )}
        </button>
        <span className="text-[10px] text-slate-300 bg-slate-850/90 border border-slate-700/60 px-2 py-0.5 rounded font-medium">
          公式
        </span>
      </div>

      {/* Ad Title & Description */}
      <div className="text-left">
        <p className="text-xs sm:text-sm font-semibold text-white leading-snug line-clamp-2">{ad.title}</p>
        <p className="text-[11px] text-slate-300 mt-1 line-clamp-2 leading-relaxed">{ad.description}</p>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {ad.tags.map((tag, idx) => (
          <span key={idx} className="text-[11px] font-medium text-slate-400 hover:text-slate-200 cursor-pointer">
            {tag}
          </span>
        ))}
      </div>

      {/* BGM sound ticker */}
      <div className="flex items-center gap-1.5 text-slate-400 text-xs overflow-hidden max-w-[240px]">
        <Music className="w-3 h-3 text-slate-500 shrink-0" />
        <span className="truncate text-[10px]">{ad.soundName}</span>
      </div>

      {/* Clean Business CTA Button */}
      <button
        onClick={() => openLpModal(ad)}
        className="w-full py-2.5 px-4 rounded-lg flex items-center justify-between font-semibold text-xs sm:text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-colors cursor-pointer active:scale-99"
      >
        <span className="truncate">{ad.ctaText}</span>
        <div className="flex items-center gap-1 text-xs text-blue-100 shrink-0">
          <span>LPを見る</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </div>
      </button>
    </div>
  );
};
