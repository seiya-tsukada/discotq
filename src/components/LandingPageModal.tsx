import React, { useState, useRef } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Star, 
  Zap, 
  Flame, 
  HelpCircle, 
  Coins,
  Lock,
  ChevronDown,
  Sparkles,
  BadgeCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { COPY_FEEDBACK_DURATION_MS } from '../constants/timing';
import { LP_READ_SCROLL_THRESHOLD_PX } from '../constants/rewards';
import { DEFAULT_COUPON_CODE } from '../constants/ads';

export const LandingPageModal: React.FC = () => {
  const { activeLpAd, closeLpModal, claimLpReadReward, user, showNotification } = useApp();
  const [copiedCoupon, setCopiedCoupon] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  if (!activeLpAd) return null;

  const { landingPage } = activeLpAd;
  const isLpReadBefore = user.watchedAdIds.includes(`lp-${activeLpAd.id}`);

  const handleScroll = () => {
    if (!contentRef.current || hasScrolledToBottom || isLpReadBefore) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    if (scrollTop + clientHeight >= scrollHeight - LP_READ_SCROLL_THRESHOLD_PX) {
      setHasScrolledToBottom(true);
      claimLpReadReward(activeLpAd.id);
    }
  };

  const copyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCoupon(true);
    showNotification(`優待コード「${code}」をコピーしました`, undefined, 'success');
    setTimeout(() => setCopiedCoupon(false), COPY_FEEDBACK_DURATION_MS);
  };

  const handleCtaClick = () => {
    showNotification(`「${activeLpAd.brandName}」の公式サイトへ移動します（デモリンク）`, undefined, 'info');
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sparkles': return <Sparkles className="w-4 h-4 text-blue-400" />;
      case 'ShieldCheck': return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'Star': return <Star className="w-4 h-4 text-amber-400" />;
      case 'Zap': return <Zap className="w-4 h-4 text-blue-400" />;
      case 'TrendingUp': return <ShieldCheck className="w-4 h-4 text-blue-400" />;
      default: return <ShieldCheck className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full h-full sm:h-[90vh] max-w-2xl bg-slate-900 border-0 sm:border border-slate-800 sm:rounded-xl flex flex-col shadow-2xl overflow-hidden">
        
        {/* Browser-like Header */}
        <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={closeLpModal}
            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Address Bar */}
          <div className="flex-1 max-w-sm mx-auto bg-slate-900 rounded-md px-3 py-1 flex items-center justify-center gap-1.5 text-xs text-slate-300 border border-slate-800 truncate">
            <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="font-medium truncate">{landingPage.externalUrl}</span>
          </div>

          {/* Read reward status */}
          <div className="flex items-center gap-1">
            {isLpReadBefore || hasScrolledToBottom ? (
              <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                <Check className="w-3 h-3" />
                +{landingPage.readRewardPoints || 10}pt 獲得済み
              </span>
            ) : (
              <span className="text-[11px] font-medium text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 flex items-center gap-1">
                <Coins className="w-3 h-3 text-blue-400" />
                末尾まで閲覧で +{landingPage.readRewardPoints || 10}pt
              </span>
            )}
          </div>
        </div>

        {/* Scrollable LP Content */}
        <div 
          ref={contentRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto bg-slate-900 text-slate-100 divide-y divide-slate-800"
        >
          {/* Hero Section */}
          <div className="relative">
            <div className="relative h-60 sm:h-64 w-full overflow-hidden bg-slate-950">
              <img
                src={landingPage.heroImage}
                alt={activeLpAd.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
            </div>

            <div className="relative px-5 pt-3 pb-5 -mt-14 z-10">
              <div className="flex items-center gap-2 mb-1.5">
                <img
                  src={activeLpAd.brandLogo}
                  alt={activeLpAd.brandName}
                  className="w-9 h-9 rounded-lg object-cover border border-slate-700 shadow-sm bg-slate-900"
                />
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-slate-300">
                      {activeLpAd.brandName}
                    </span>
                    <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <h1 className="text-lg sm:text-xl font-bold text-white leading-tight">
                    {activeLpAd.title}
                  </h1>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-2">
                {landingPage.subTitle}
              </p>
            </div>
          </div>

          {/* Official Special Offer / Coupon Card */}
          {landingPage.specialOffer && (
            <div className="p-5 bg-slate-950">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-750 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-blue-400">
                    提携プロモーション優待
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    有効期限: {landingPage.specialOffer.expiresAt}
                  </span>
                </div>

                <p className="text-sm sm:text-base font-bold text-slate-100 mb-3">
                  {landingPage.specialOffer.discount}
                </p>

                <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 font-medium">優待コード:</span>
                    <p className="font-mono font-bold text-slate-200 text-sm tracking-wider">
                      {landingPage.specialOffer.couponCode}
                    </p>
                  </div>
                  <button
                    onClick={() => copyCouponCode(landingPage.specialOffer!.couponCode)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    {copiedCoupon ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCoupon ? 'コピー完了' : 'コードをコピー'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Key Features */}
          <div className="p-5 space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              製品・サービスの特徴
            </h2>
            <div className="grid gap-2.5">
              {landingPage.keyFeatures.map((feat, idx) => (
                <div 
                  key={idx} 
                  className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-3"
                >
                  <div className="p-1.5 rounded-md bg-slate-900 shrink-0 border border-slate-800">
                    {renderIcon(feat.icon)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-xs sm:text-sm text-slate-200">{feat.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Reviews */}
          <div className="p-5 space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              ユーザー評価・導入事例
            </h2>
            <div className="space-y-2.5">
              {landingPage.reviews.map((rev, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <img
                        src={rev.avatar}
                        alt={rev.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                      <span className="text-xs font-medium text-slate-200">{rev.name}</span>
                    </div>
                    <div className="flex text-amber-400">
                      {[...Array(rev.rating)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{rev.comment}</p>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ Accordion */}
          <div className="p-5 space-y-2.5">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
              <span>よくあるご質問</span>
            </h2>
            <div className="space-y-1.5">
              {landingPage.faqs.map((faq, idx) => (
                <div key={idx} className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
                  <button
                    onClick={() => setExpandedFaqIndex(expandedFaqIndex === idx ? null : idx)}
                    className="w-full p-3 text-left flex items-center justify-between text-xs font-medium text-slate-200 hover:text-white transition-colors"
                  >
                    <span>Q. {faq.q}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expandedFaqIndex === idx ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedFaqIndex === idx && (
                    <div className="px-3 pb-3 text-xs text-slate-400 border-t border-slate-850 pt-2 leading-relaxed">
                      A. {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notice */}
          <div className="p-4 text-center bg-slate-950/50">
            <p className="text-[11px] text-slate-500">
              ※ 本ページはスポンサー企業「{activeLpAd.brandName}」による公式情報提供ページです。
            </p>
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center gap-3 shrink-0">
          <button
            onClick={() => copyCouponCode(landingPage.specialOffer?.couponCode || DEFAULT_COUPON_CODE)}
            className="px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="コードコピー"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">優待コード</span>
          </button>

          <button
            onClick={handleCtaClick}
            className="flex-1 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm shadow transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-99"
          >
            <span>{landingPage.ctaButtonText}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
