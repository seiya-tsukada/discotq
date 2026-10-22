import React from 'react';
import { CheckCircle2, ExternalLink, Check, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AdItem } from '../../types';

interface ModerationQueueProps {
  pendingAds: AdItem[];
  selectedAdForReview: AdItem | null;
  onSelectAdForReview: (ad: AdItem | null) => void;
  feedbackInput: string;
  onFeedbackInputChange: (value: string) => void;
  onApprove: (adId: string) => void;
  onReject: (adId: string) => void;
}

// Tab 1: Moderation / Ad Review Queue
export const ModerationQueue: React.FC<ModerationQueueProps> = ({
  pendingAds,
  selectedAdForReview,
  onSelectAdForReview,
  feedbackInput,
  onFeedbackInputChange,
  onApprove,
  onReject,
}) => {
  const { openLpModal } = useApp();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>入稿広告の審査キュー</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {pendingAds.length} 件保留中
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            薬機法・景品表示法・著作権・クリエイティブ品質ガイドラインの審査を実施します。
          </p>
        </div>
      </div>

      {pendingAds.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="text-sm font-semibold text-white">審査待ちはすべて完了しています</h3>
          <p className="text-xs text-slate-400">現在提出されているすべてのクリエイティブが審査済みです。</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {pendingAds.map((ad) => (
            <div
              key={ad.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col lg:flex-row gap-5 items-start justify-between"
            >
              {/* Media Preview */}
              <div className="relative w-36 h-48 rounded-xl overflow-hidden bg-slate-950 shrink-0 border border-slate-800">
                <video src={ad.videoUrl} poster={ad.posterUrl} controls className="w-full h-full object-cover" />
              </div>

              {/* Metadata & Audit Info */}
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-blue-400">@{ad.brandName}</span>
                  <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {ad.category}
                  </span>
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    未審査
                  </span>
                  <span className="text-[10px] text-slate-500 ml-auto">入稿日: {ad.createdAt}</span>
                </div>

                <h3 className="text-base font-bold text-white">{ad.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{ad.description}</p>

                {/* LP / CTA / Reward preview */}
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-850 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">CTAアクション</span>
                    <span className="font-semibold text-slate-200 truncate block">{ad.ctaText}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">遷移先LP</span>
                    <a
                      href={ad.landingPage.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline flex items-center gap-1 truncate"
                    >
                      <span className="truncate">{ad.landingPage.externalUrl}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">付与リワード / 予算</span>
                    <span className="font-semibold text-emerald-400">
                      +{ad.rewardPoints}pt / ¥{ad.totalBudget.toLocaleString()}
                    </span>
                  </div>
                </div>

                {ad.reviewFeedback && (
                  <p className="text-xs text-slate-400 italic">過去の審査メモ: {ad.reviewFeedback}</p>
                )}
              </div>

              {/* Moderation Action Buttons */}
              <div className="flex flex-col gap-2 w-full lg:w-48 shrink-0">
                <button
                  onClick={() => onApprove(ad.id)}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>承認して配信開始</span>
                </button>

                <button
                  onClick={() => onSelectAdForReview(selectedAdForReview?.id === ad.id ? null : ad)}
                  className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                >
                  <X className="w-4 h-4" />
                  <span>差戻し・修正指示</span>
                </button>

                <button
                  onClick={() => openLpModal(ad)}
                  className="w-full py-1.5 px-3 rounded-lg text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer"
                >
                  LP内容を確認
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rejection / Feedback Modal Drawer */}
      {selectedAdForReview && (
        <div className="p-4 rounded-xl bg-slate-900 border border-rose-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-rose-400">「{selectedAdForReview.title}」の差戻し理由と修正指示</h4>
            <button onClick={() => onSelectAdForReview(null)} className="text-xs text-slate-400 hover:text-white">
              閉じる
            </button>
          </div>
          <textarea
            rows={2}
            placeholder="例: タイトルの表現が景品表示法の優良誤認を招く恐れがあります。客観的根拠の注記を追記してください。"
            value={feedbackInput}
            onChange={(e) => onFeedbackInputChange(e.target.value)}
            className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500"
          />
          <button
            onClick={() => onReject(selectedAdForReview.id)}
            className="py-2 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            差戻しを送信する
          </button>
        </div>
      )}
    </div>
  );
};
