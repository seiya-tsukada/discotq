import React, { useState } from 'react';
import { X, Copy, Check, Share2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SHARE_COPY_FEEDBACK_DURATION_MS } from '../constants/timing';

export const ShareModal: React.FC = () => {
  const { isShareModalOpen, setIsShareModalOpen, ads, currentAdIndex, showNotification } = useApp();
  const [copied, setCopied] = useState(false);

  if (!isShareModalOpen) return null;

  const currentAd = ads[currentAdIndex] || ads[0];
  const shareUrl = `${window.location.origin}/#ad-${currentAd.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    showNotification('共有リンクをクリップボードにコピーしました', undefined, 'success');
    setTimeout(() => setCopied(false), SHARE_COPY_FEEDBACK_DURATION_MS);
  };

  const handleSnsShare = (platform: string) => {
    showNotification(`${platform}で「${currentAd.title}」を共有しました（デモ）`, undefined, 'info');
    setIsShareModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs sm:text-sm font-semibold text-white">広告コンテンツを共有</h3>
          </div>
          <button
            onClick={() => setIsShareModalOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5">
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
            <img src={currentAd.posterUrl} alt={currentAd.title} className="w-10 h-14 rounded-md object-cover" />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-slate-400 font-semibold block">{currentAd.brandName}</span>
              <p className="text-xs font-semibold text-white truncate">{currentAd.title}</p>
              <span className="text-[10px] text-blue-400 font-medium">公式プロモーション</span>
            </div>
          </div>

          {/* Social share options */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleSnsShare('X (Twitter)')}
              className="p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 flex flex-col items-center gap-1 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center text-xs text-white font-bold border border-slate-800">
                𝕏
              </div>
              <span className="text-[10px] font-medium text-slate-300">X (Twitter)</span>
            </button>

            <button
              onClick={() => handleSnsShare('LINE')}
              className="p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 flex flex-col items-center gap-1 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center font-bold text-[10px] text-emerald-400 border border-slate-800">
                LINE
              </div>
              <span className="text-[10px] font-medium text-slate-300">LINE</span>
            </button>

            <button
              onClick={() => handleSnsShare('LinkedIn')}
              className="p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 flex flex-col items-center gap-1 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center font-bold text-[10px] text-blue-400 border border-slate-800">
                in
              </div>
              <span className="text-[10px] font-medium text-slate-300">LinkedIn</span>
            </button>
          </div>

          {/* Copy input */}
          <div className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-950 border border-slate-800">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-transparent text-xs text-slate-400 px-2 select-all focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'コピー済' : 'コピー'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
