import React, { useState } from 'react';
import { 
  PlusCircle, 
  TrendingUp, 
  Eye, 
  MousePointer, 
  Video, 
  Play, 
  Pause, 
  CreditCard, 
  BarChart3,
  ShieldCheck,
  BadgeCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AD_PLANS } from '../data/mockAds';
import { AdItem, AdLandingPage } from '../types';

const SAMPLE_VIDEOS = [
  {
    name: '製品・ハードウェア',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    poster: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
    category: 'ガジェット・家電' as const,
  },
  {
    name: 'ビジネスSaaS・IT',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    poster: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80',
    category: 'ガジェット・家電' as const,
  },
  {
    name: 'オーガニックコスメ',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    poster: 'https://images.unsplash.com/photo-1608248597359-0a6230873a4b?w=800&auto=format&fit=crop&q=80',
    category: 'コスメ・美容' as const,
  },
  {
    name: 'ウェルネス・フード',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    poster: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
    category: 'グルメ・食品' as const,
  },
];

export const AdvertiserPortal: React.FC<{ onSwitchToFeed: () => void }> = ({ onSwitchToFeed }) => {
  const { ads, createNewAd, toggleAdStatus, setCurrentAdIndex } = useApp();
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  
  // Create Ad Form State
  const [selectedPlanId, setSelectedPlanId] = useState('plan-boost');
  const [brandName, setBrandName] = useState('');
  const [brandLogo, setBrandLogo] = useState('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'コスメ・美容' | 'ガジェット・家電' | 'グルメ・食品' | 'アプリ・ゲーム' | 'ライフスタイル・旅行' | 'ファッション'>('ガジェット・家電');
  const [tagInput, setTagInput] = useState('#ビジネス #最新モデル #公式ストア');
  const [videoUrl, setVideoUrl] = useState(SAMPLE_VIDEOS[0].url);
  const [posterUrl, setPosterUrl] = useState(SAMPLE_VIDEOS[0].poster);
  const [ctaText, setCtaText] = useState('公式ストアで詳細を見る');
  const [rewardPoints, setRewardPoints] = useState(20);
  const [budget, setBudget] = useState(50000);
  const [couponCode, setCouponCode] = useState('ADTOK-OFFICIAL');
  const [discountText, setDiscountText] = useState('公式ストア限定 15% 優待適用');
  const [feature1Title, setFeature1Title] = useState('品質基準と独自テクノロジー');
  const [feature1Desc, setFeature1Desc] = useState('徹底した品質検査をクリアした信頼の設計');
  const [feature2Title, setFeature2Title] = useState('充実したアフターサポート');
  const [feature2Desc, setFeature2Desc] = useState('専任チームによる万全のカスタマーサポート体制');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPlan = AD_PLANS.find((p) => p.id === selectedPlanId) || AD_PLANS[1];

  const estimatedViews = Math.floor(budget / selectedPlan.pricePerView);
  const estimatedImpressions = Math.floor(estimatedViews * 1.5);
  const estimatedClicks = Math.floor(estimatedViews * 0.1);

  const handleSelectSample = (sample: typeof SAMPLE_VIDEOS[0]) => {
    setVideoUrl(sample.url);
    setPosterUrl(sample.poster);
    setCategory(sample.category);
  };

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !brandName.trim()) {
      alert('ブランド名と広告タイトルを入力してください');
      return;
    }

    setIsSubmitting(true);

    const landingPage: AdLandingPage = {
      heroImage: posterUrl,
      subTitle: description || 'DiscoTQ公式スポンサーがお届けするプロダクト情報',
      keyFeatures: [
        { title: feature1Title, desc: feature1Desc, icon: 'ShieldCheck' },
        { title: feature2Title, desc: feature2Desc, icon: 'Zap' },
        { title: '高いユーザー満足度と導入実績', desc: 'ビジネス・ライフスタイルを支える確かな品質', icon: 'Star' },
      ],
      specialOffer: {
        couponCode: couponCode || 'ADTOK2026',
        discount: discountText || '公式ストア限定特典適用',
        expiresAt: '2026年12月末まで',
      },
      reviews: [
        { name: '公式導入企業レビュー', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80', rating: 5, comment: '動画広告経由で製品スペックを素早く確認でき、導入も非常にスムーズでした。' }
      ],
      faqs: [
        { q: '製品のお問い合わせやサポート体制について', a: '公式サイトの専用フォームおよびお電話にて迅速に対応いたします。' }
      ],
      externalUrl: `https://${brandName.toLowerCase().replace(/\s+/g, '')}.co.jp`,
      ctaButtonText: '公式サイトで製品仕様を確認する',
      readRewardPoints: 10,
    };

    const tags = tagInput
      .split(' ')
      .filter((t) => t.trim().length > 0)
      .map((t) => (t.startsWith('#') ? t : `#${t}`));

    setTimeout(() => {
      createNewAd({
        brandName,
        brandLogo,
        verified: true,
        title,
        description,
        tags: tags.length > 0 ? tags : ['#公式プロモーション', '#新発売'],
        videoUrl,
        posterUrl,
        category,
        ctaText,
        ctaType: 'primary',
        rewardPoints: Number(rewardPoints),
        minWatchSeconds: 5,
        soundName: `${brandName} Audio Brand Track`,
        soundAuthor: `${brandName} Media`,
        landingPage,
        advertiserId: 'client-' + Date.now(),
        totalBudget: budget,
        status: 'active',
      });

      setIsSubmitting(false);
      onSwitchToFeed();
    }, 800);
  };

  const totalImpressions = ads.reduce((acc, a) => acc + a.impressions, 0);
  const totalViews = ads.reduce((acc, a) => acc + a.views, 0);
  const totalClicks = ads.reduce((acc, a) => acc + a.clicks, 0);
  const totalBudgetSpent = ads.reduce((acc, a) => acc + a.budgetSpent, 0);
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0.0';

  return (
    <div className="min-h-[calc(100vh-3.75rem)] bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-800">
                DiscoTQ Ads Manager
              </span>
              <span className="text-xs text-slate-400">広告出稿・キャンペーン管理ポータル</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
              広告枠の購入・キャンペーン出稿
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              完全視聴保証型のリワード広告で、確実な認知拡大と公式LPへの遷移を両立します。
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>新しい広告枠を出店</span>
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'manage'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>配信中キャンペーン一覧（{ads.length}）</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Create Ad */}
        {activeTab === 'create' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="lg:col-span-2 space-y-6">
              
              {/* Step 1: Plan Selection */}
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center border border-slate-700">
                    1
                  </span>
                  <h2 className="text-sm font-bold text-white">広告枠プランの選定</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {AD_PLANS.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        if (budget < plan.minBudget) setBudget(plan.minBudget);
                      }}
                      className={`p-3.5 rounded-lg border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                        selectedPlanId === plan.id
                          ? 'bg-slate-850 border-blue-500 ring-1 ring-blue-500/50 shadow-sm'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {plan.recommended && (
                        <span className="absolute -top-2 right-2 text-[9px] font-semibold uppercase bg-blue-600 text-white px-2 py-0.5 rounded shadow">
                          推奨
                        </span>
                      )}
                      <div>
                        <h3 className="font-semibold text-xs sm:text-sm text-white mb-1">{plan.name}</h3>
                        <p className="text-[11px] text-slate-400 leading-tight mb-2">{plan.tagline}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-800 mt-2">
                        <span className="text-[11px] text-slate-400">1再生単価:</span>
                        <div className="text-base font-bold text-blue-400">¥{plan.pricePerView}</div>
                        <span className="text-[10px] text-slate-500">最低予算: ¥{plan.minBudget.toLocaleString()}〜</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Creative Form */}
              <form onSubmit={handleCreateCampaign} className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center border border-slate-700">
                    2
                  </span>
                  <h2 className="text-sm font-bold text-white">広告クリエイティブ・LP設定</h2>
                </div>

                {/* Preset Selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    サンプル動画・テンプレート（クリックで入力補完）:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SAMPLE_VIDEOS.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectSample(s)}
                        className={`p-2 rounded-lg border text-left text-xs transition-all flex items-center gap-2 cursor-pointer ${
                          videoUrl === s.url
                            ? 'bg-slate-800 border-blue-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Video className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="truncate font-medium">{s.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      ブランド名 / 企業名 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="例: Apex Audio Japan"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      業種・カテゴリ
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="ガジェット・家電">ガジェット・家電</option>
                      <option value="コスメ・美容">コスメ・美容</option>
                      <option value="グルメ・食品">グルメ・食品</option>
                      <option value="アプリ・ゲーム">アプリ・ゲーム</option>
                      <option value="ライフスタイル・旅行">ライフスタイル・旅行</option>
                      <option value="ファッション">ファッション</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    広告タイトル (キャッチコピー) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="例: ビジネスの移動時間を上質な静寂に変える新世代ワイヤレスイヤホン"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    製品・サービス詳細
                  </label>
                  <textarea
                    rows={2}
                    placeholder="製品の特長、保証内容、公式サポートの情報を入力..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      CTAボタン表示テキスト
                    </label>
                    <input
                      type="text"
                      placeholder="例: 公式サイトで仕様・特典を見る"
                      value={ctaText}
                      onChange={(e) => setCtaText(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      タグ
                    </label>
                    <input
                      type="text"
                      placeholder="#公式 #ビジネス #新製品"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Reward & Budget */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      視聴者リワード付与 (1視聴あたり): <span className="text-blue-400 font-semibold">{rewardPoints} pt</span>
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="40"
                      step="5"
                      value={rewardPoints}
                      onChange={(e) => setRewardPoints(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-500">
                      ※ 視聴完了時にユーザーへ付与されるリワードです。
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      出稿予算: <span className="text-slate-100 font-bold">¥{budget.toLocaleString()}</span>
                    </label>
                    <input
                      type="range"
                      min={selectedPlan.minBudget}
                      max={200000}
                      step={5000}
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* LP Details Section */}
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span>アプリ内サービス説明（LP）の優待設定</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">優待コード</label>
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">優待内容</label>
                      <input
                        type="text"
                        value={discountText}
                        onChange={(e) => setDiscountText(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit / Purchase Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {isSubmitting ? '処理中...' : `広告枠を購入して配信を開始する (¥${budget.toLocaleString()})`}
                  </span>
                </button>
              </form>
            </div>

            {/* Projection Column */}
            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 text-left">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs sm:text-sm font-bold text-white">配信効果シミュレーション</h3>
                </div>

                <div className="space-y-2.5">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400">想定インプレッション</span>
                      <p className="text-base font-bold text-white">{estimatedImpressions.toLocaleString()} 回</p>
                    </div>
                    <Eye className="w-4 h-4 text-slate-500" />
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400">想定完全視聴数 (5秒以上)</span>
                      <p className="text-base font-bold text-blue-400">{estimatedViews.toLocaleString()} 回</p>
                    </div>
                    <Video className="w-4 h-4 text-blue-400/60" />
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400">想定LP遷移数</span>
                      <p className="text-base font-bold text-emerald-400">{estimatedClicks.toLocaleString()} 回</p>
                    </div>
                    <MousePointer className="w-4 h-4 text-emerald-400/60" />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 leading-relaxed">
                  ※ 視聴完了者に対するリワード付与により、一般的なインフィード広告と比較して高い視聴維持率とブランド想起率が期待できます。
                </div>
              </div>

              {/* Preview */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <span className="text-xs font-semibold text-slate-400 mb-2 block">配信プレビュー</span>
                <div className="relative mx-auto w-48 h-80 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shadow-md">
                  <img
                    src={posterUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40 pointer-events-none" />
                  
                  <div className="absolute top-2 left-2 right-2 px-2 py-0.5 rounded bg-slate-900/90 text-[8px] font-medium text-slate-200 border border-slate-750">
                    視聴リワード: +{rewardPoints}pt
                  </div>

                  <div className="absolute bottom-2 left-2 right-2 text-left text-white">
                    <p className="text-[9px] font-bold leading-tight line-clamp-1">{title || '広告タイトル'}</p>
                    <p className="text-[8px] text-slate-300 line-clamp-1">@{brandName || 'ブランド名'}</p>
                    <div className="mt-1 py-1 px-2 rounded bg-blue-600 text-[8px] font-semibold text-center text-white">
                      {ctaText}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* Tab 2: Manage */
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs font-medium text-slate-400">総インプレッション</span>
                <p className="text-xl font-bold text-white mt-1">
                  {totalImpressions.toLocaleString()}
                </p>
                <span className="text-[10px] text-emerald-400 font-medium mt-1 inline-block">
                  通常比 +14.8%
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs font-medium text-slate-400">完全視聴数</span>
                <p className="text-xl font-bold text-blue-400 mt-1">
                  {totalViews.toLocaleString()}
                </p>
                <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">
                  視聴完了率: 68.2%
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs font-medium text-slate-400">LP遷移クリック</span>
                <p className="text-xl font-bold text-slate-100 mt-1">
                  {totalClicks.toLocaleString()}
                </p>
                <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">
                  平均CTR: {avgCtr}%
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs font-medium text-slate-400">消化広告費</span>
                <p className="text-xl font-bold text-slate-200 mt-1">
                  ¥{totalBudgetSpent.toLocaleString()}
                </p>
                <span className="text-[10px] text-slate-500 font-medium mt-1 inline-block">
                  リワード付与分含む
                </span>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm sm:text-base text-white">出稿キャンペーン一覧</h3>
                <span className="text-xs text-slate-400">計 {ads.length} 件</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-medium border-b border-slate-800">
                    <tr>
                      <th className="p-3">広告クリエイティブ</th>
                      <th className="p-3">ステータス</th>
                      <th className="p-3">視聴数 / 表示回数</th>
                      <th className="p-3">LPクリック</th>
                      <th className="p-3">付与pt</th>
                      <th className="p-3">予算消化</th>
                      <th className="p-3 text-right">アクション</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {ads.map((ad, index) => (
                      <tr key={ad.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={ad.posterUrl}
                              alt={ad.title}
                              className="w-10 h-14 rounded-md object-cover bg-slate-950 shrink-0"
                            />
                            <div className="max-w-[200px]">
                              <p className="font-semibold text-white truncate">{ad.title}</p>
                              <p className="text-[11px] text-slate-400 truncate">{ad.brandName}・{ad.category}</p>
                              <span className="text-[10px] text-slate-500">{ad.tags.slice(0, 2).join(' ')}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => toggleAdStatus(ad.id)}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                              ad.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {ad.status === 'active' ? (
                              <>
                                <Play className="w-2.5 h-2.5 fill-emerald-400" />
                                配信中
                              </>
                            ) : (
                              <>
                                <Pause className="w-2.5 h-2.5 fill-slate-400" />
                                停止中
                              </>
                            )}
                          </button>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-white">{ad.views.toLocaleString()} 回</div>
                          <span className="text-[10px] text-slate-500">{ad.impressions.toLocaleString()} imp</span>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-200">{ad.clicks.toLocaleString()} 回</div>
                          <span className="text-[10px] text-slate-500">
                            CTR: {ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : 0}%
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-blue-400">+{ad.rewardPoints}pt</span>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-white">¥{ad.budgetSpent.toLocaleString()}</div>
                          <div className="w-16 bg-slate-800 rounded-full h-1 mt-1 overflow-hidden">
                            <div
                              className="bg-blue-500 h-full rounded-full"
                              style={{ width: `${Math.min(100, (ad.budgetSpent / ad.totalBudget) * 100)}%` }}
                            />
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              setCurrentAdIndex(index);
                              onSwitchToFeed();
                            }}
                            className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-750 text-slate-200 font-medium text-[11px] transition-colors cursor-pointer"
                          >
                            確認
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
