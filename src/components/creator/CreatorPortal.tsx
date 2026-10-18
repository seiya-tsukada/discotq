import React, { useState } from 'react';
import { 
  Upload, 
  Video, 
  FileText, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  Eye, 
  MousePointer, 
  Coins, 
  ArrowRight, 
  ShieldCheck, 
  Edit3, 
  Trash2, 
  Play, 
  Pause,
  Layers,
  BarChart2,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AdItem, AdLandingPage } from '../../types';

const PRESET_CREATIVES = [
  {
    name: '製品・ハードウェア (高精細動画)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    poster: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
    category: 'ガジェット・家電' as const,
  },
  {
    name: 'ビジネスIT・SaaS (アニメーション)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    poster: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80',
    category: 'ガジェット・家電' as const,
  },
  {
    name: 'ライフスタイル・ウェルネス',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    poster: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
    category: 'グルメ・食品' as const,
  },
];

export const CreatorPortal: React.FC = () => {
  const { ads, createNewAd, updateAdCreative, toggleAdStatus, deleteAd } = useApp();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'analytics'>('dashboard');
  const [selectedAdForEdit, setSelectedAdForEdit] = useState<AdItem | null>(null);

  // Form State
  const [brandName, setBrandName] = useState('BOTANICAL LAB Tokyo');
  const [brandLogo, setBrandLogo] = useState('https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=100&auto=format&fit=crop&q=80');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'コスメ・美容' | 'ガジェット・家電' | 'グルメ・食品' | 'アプリ・ゲーム' | 'ライフスタイル・旅行' | 'ファッション'>('コスメ・美容');
  const [tags, setTags] = useState('#新作 #おすすめ #限定優待');
  const [videoUrl, setVideoUrl] = useState(PRESET_CREATIVES[0].url);
  const [posterUrl, setPosterUrl] = useState(PRESET_CREATIVES[0].poster);
  const [ctaText, setCtaText] = useState('公式サイトで詳細・仕様を見る');
  const [rewardPoints, setRewardPoints] = useState(20);
  const [budget, setBudget] = useState(50000);
  const [externalUrl, setExternalUrl] = useState('https://example.com/official-offer');
  const [couponCode, setCouponCode] = useState('ADTOK-OFFER');
  const [discountText, setDiscountText] = useState('公式ストア限定 20% 優待適用');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Handle Mock File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      // Create local object URL for preview
      const objectUrl = URL.createObjectURL(file);
      setVideoUrl(objectUrl);
      setPosterUrl('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80');
    }
  };

  const handleSelectPreset = (preset: typeof PRESET_CREATIVES[0]) => {
    setVideoUrl(preset.url);
    setPosterUrl(preset.poster);
    setCategory(preset.category);
    setUploadedFileName(null);
  };

  const handleSubmitAd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !brandName.trim()) {
      alert('ブランド名とタイトルを入力してください');
      return;
    }

    setIsSubmitting(true);

    const landingPage: AdLandingPage = {
      heroImage: posterUrl,
      subTitle: description || 'DiscoTQ公式スポンサーがお届けするサービス詳細',
      keyFeatures: [
        { title: '独自設計と徹底した品質管理', desc: '厳しい検査基準をクリアした安心のプロダクト', icon: 'ShieldCheck' },
        { title: '公式限定サポート体制', desc: '専任スタッフによる万全のカスタマーサポート', icon: 'Zap' },
        { title: '高いユーザー満足度', desc: 'ユーザーアンケートで95%以上の高評価を獲得', icon: 'Star' },
      ],
      specialOffer: {
        couponCode: couponCode || 'ADTOK2026',
        discount: discountText || '特別優待適用',
        expiresAt: '2026年12月末まで',
      },
      reviews: [
        { name: '公式導入ユーザー', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80', rating: 5, comment: '動画広告で要点が分かりやすく、スムーズに利用できました。' },
      ],
      faqs: [
        { q: '利用開始の手続きについて', a: '公式ウェブサイトより最短3分でお手続き可能です。' },
      ],
      externalUrl: externalUrl || 'https://example.com',
      ctaButtonText: '公式サイトで詳細を確認する',
      readRewardPoints: 10,
    };

    const formattedTags = tags
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
        tags: formattedTags.length > 0 ? formattedTags : ['#公式プロモーション'],
        videoUrl,
        posterUrl,
        category,
        ctaText,
        ctaType: 'primary',
        rewardPoints: Number(rewardPoints),
        minWatchSeconds: 5,
        soundName: `${brandName} Official Brand Audio`,
        soundAuthor: `${brandName} Sound Studio`,
        landingPage,
        advertiserId: 'creator-current',
        creatorName: brandName,
        creatorEmail: 'creator@business.example.com',
        totalBudget: budget,
        status: 'paused', // initially paused until approved
      });

      setIsSubmitting(false);
      setActiveTab('dashboard');
    }, 600);
  };

  // Metrics for creator
  const totalImpressions = ads.reduce((acc, a) => acc + a.impressions, 0);
  const totalViews = ads.reduce((acc, a) => acc + a.views, 0);
  const totalClicks = ads.reduce((acc, a) => acc + a.clicks, 0);
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0.0';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 py-3.5 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm">
            Ad
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base">DiscoTQ Creator Studio</span>
              <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                /creator
              </span>
            </div>
            <p className="text-[11px] text-slate-400">広告配信者・クリエイター向け運用管理ポータル</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ダッシュボード & 改善
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>新規広告アップロード</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Tab 1: Dashboard & Improvement Center */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* KPI Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">総配信インプレッション</span>
                <p className="text-2xl font-bold text-white mt-1">{totalImpressions.toLocaleString()}</p>
                <span className="text-[10px] text-emerald-400 font-medium mt-1 inline-block">同業種平均 +18.2%</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">完全視聴数 (5秒以上)</span>
                <p className="text-2xl font-bold text-blue-400 mt-1">{totalViews.toLocaleString()}</p>
                <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">平均維持率: 68.4%</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">公式LP遷移数</span>
                <p className="text-2xl font-bold text-slate-100 mt-1">{totalClicks.toLocaleString()}</p>
                <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">平均CTR: {avgCtr}%</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">登録済みクリエイティブ</span>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{ads.length} 本</p>
                <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">承認済み: {ads.filter(a => a.reviewStatus === 'approved').length} 本</span>
              </div>
            </div>

            {/* Creative Improvement & Optimization Section */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-white">クリエイティブ改善ダッシュボード</h2>
                    <p className="text-xs text-slate-400">データ分析に基づく離脱防止・CVR最大化の改善アドバイス</p>
                  </div>
                </div>
              </div>

              {/* Optimization Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ads[0]?.optimization?.suggestedImprovements?.map((tip, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                          {tip.type.toUpperCase()} 改善提案
                        </span>
                        <span className="text-xs font-bold text-emerald-400">
                          想定効果: {tip.expectedLift}
                        </span>
                      </div>
                      <h3 className="text-xs sm:text-sm font-semibold text-white mb-1">{tip.title}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">{tip.description}</p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-850 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">対象: {ads[0].title}</span>
                      <button
                        onClick={() => setActiveTab('upload')}
                        className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                      >
                        <span>改善版をアップロード</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Campaign Management List */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">入稿・出店中のショート広告一覧</h2>
                  <p className="text-xs text-slate-400">配信設定、LP編集、審査ステータスの確認</p>
                </div>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>新規入稿</span>
                </button>
              </div>

              <div className="grid gap-3">
                {ads.map((ad) => (
                  <div
                    key={ad.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Left: Thumbnail & Info */}
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div className="relative w-14 h-20 rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-slate-800">
                        <img
                          src={ad.posterUrl}
                          alt={ad.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-200 truncate">{ad.brandName}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                            {ad.category}
                          </span>

                          {/* Review Badge */}
                          {ad.reviewStatus === 'approved' ? (
                            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              審査承認済
                            </span>
                          ) : ad.reviewStatus === 'pending' ? (
                            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              審査中
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              要修正・差戻し
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-semibold text-white leading-snug line-clamp-1">{ad.title}</h3>
                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">CTA: 「{ad.ctaText}」 → LP: {ad.landingPage.externalUrl}</p>
                        
                        {ad.reviewFeedback && (
                          <p className="text-[11px] text-slate-500 mt-1 italic">
                            ※ 審査コメント: {ad.reviewFeedback}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Middle: Performance */}
                    <div className="flex items-center gap-6 text-xs text-slate-300 pl-0 md:pl-4 border-t md:border-t-0 md:border-l border-slate-850 pt-2 md:pt-0">
                      <div>
                        <span className="text-[10px] text-slate-500 block">視聴数</span>
                        <span className="font-bold text-white">{ad.views.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">LPクリック</span>
                        <span className="font-bold text-blue-400">{ad.clicks.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">リワード付与</span>
                        <span className="font-bold text-slate-200">{ad.rewardPoints} pt</span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => toggleAdStatus(ad.id)}
                        className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                          ad.status === 'active'
                            ? 'bg-slate-850 hover:bg-slate-800 text-slate-300'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                        title={ad.status === 'active' ? '配信停止' : '配信開始'}
                      >
                        {ad.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => deleteAd(ad.id)}
                        className="p-2 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer border border-slate-800"
                        title="広告を削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Upload / Creative Studio Form */}
        {activeTab === 'upload' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="pb-4 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white">新しいショート広告の入稿・LP設定</h2>
              <p className="text-xs text-slate-400 mt-1">
                動画・静止画クリエイティブをアップロードし、訴求タイトル、CTA、アプリ内LP詳細を設定します。
              </p>
            </div>

            <form onSubmit={handleSubmitAd} className="space-y-6">
              
              {/* Media Upload Box */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Video className="w-4 h-4 text-blue-400" />
                  <span>1. クリエイティブ素材のアップロード</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Dropzone */}
                  <div className="relative border-2 border-dashed border-slate-750 hover:border-blue-500 rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors bg-slate-950/60">
                    <input
                      type="file"
                      accept="video/*,image/*"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="text-xs font-semibold text-white">
                      {uploadedFileName ? `選択中: ${uploadedFileName}` : '動画・静止画ファイルをドラッグ＆ドロップ'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">MP4, MOV, WebM, PNG, JPG (9:16縦型推奨)</p>
                  </div>

                  {/* Preset alternatives */}
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-slate-400 block">または サンプル動画から選択:</span>
                    <div className="space-y-2">
                      {PRESET_CREATIVES.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectPreset(p)}
                          className={`w-full p-2.5 rounded-lg border text-left text-xs transition-colors flex items-center gap-2.5 cursor-pointer ${
                            videoUrl === p.url && !uploadedFileName
                              ? 'bg-slate-850 border-blue-500 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Video className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="truncate font-medium">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Title & Copy Settings */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>2. 広告タイトル・詳細設定</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      ブランド / 出店者名 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="例: BOTANICAL LAB Tokyo"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      カテゴリ
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="コスメ・美容">コスメ・美容</option>
                      <option value="ガジェット・家電">ガジェット・家電</option>
                      <option value="グルメ・食品">グルメ・食品</option>
                      <option value="アプリ・ゲーム">アプリ・ゲーム</option>
                      <option value="ライフスタイル・旅行">ライフスタイル・旅行</option>
                      <option value="ファッション">ファッション</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    広告キャッチコピー (タイトル) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="例: 自然由来98%の集中リペア美容液「NatureDrop」"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    詳細説明文
                  </label>
                  <textarea
                    rows={2}
                    placeholder="商品の特徴やキャンペーン概要を入力..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      CTAボタンテキスト
                    </label>
                    <input
                      type="text"
                      value={ctaText}
                      onChange={(e) => setCtaText(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      ハッシュタグ
                    </label>
                    <input
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* LP & Offer Details */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-blue-400" />
                  <span>3. アプリ内LP・優待クーポン設定</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      公式LPリンクURL
                    </label>
                    <input
                      type="url"
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      限定優待コード
                    </label>
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    優待割引・オファー内容
                  </label>
                  <input
                    type="text"
                    value={discountText}
                    onChange={(e) => setDiscountText(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Reward & Budget */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-blue-400" />
                  <span>4. リワード付与 & 配信予算設定</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      1視聴あたり付与リワード: <span className="text-blue-400 font-bold">{rewardPoints} pt</span>
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
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      出稿予算: <span className="text-white font-bold">¥{budget.toLocaleString()}</span>
                    </label>
                    <input
                      type="range"
                      min={10000}
                      max={200000}
                      step={5000}
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm shadow transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isSubmitting ? '審査申請中...' : '広告をアップロードして審査に提出する'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="py-3 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors border border-slate-800 cursor-pointer"
                >
                  キャンセル
                </button>
              </div>

            </form>
          </div>
        )}

      </main>
    </div>
  );
};
