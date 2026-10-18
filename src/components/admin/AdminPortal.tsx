import React, { useState } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Users, 
  Layers, 
  TrendingUp, 
  Coins, 
  Eye, 
  Video, 
  ExternalLink, 
  Filter, 
  Clock, 
  Check, 
  X,
  Search,
  Building,
  BarChart3,
  SlidersHorizontal,
  BadgeCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AdItem } from '../../types';

export const AdminPortal: React.FC = () => {
  const { ads, creators, updateAdReviewStatus, toggleAdStatus, openLpModal } = useApp();
  const [activeTab, setActiveTab] = useState<'moderation' | 'creators' | 'allAds'>('moderation');
  const [selectedAdForReview, setSelectedAdForReview] = useState<AdItem | null>(null);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const pendingAds = ads.filter((a) => a.reviewStatus === 'pending');
  const approvedAds = ads.filter((a) => a.reviewStatus === 'approved');
  const rejectedAds = ads.filter((a) => a.reviewStatus === 'rejected');

  const handleApprove = (adId: string) => {
    updateAdReviewStatus(adId, 'approved');
    setSelectedAdForReview(null);
  };

  const handleReject = (adId: string) => {
    if (!feedbackInput.trim()) {
      alert('差戻し理由・修正アドバイスを入力してください');
      return;
    }
    updateAdReviewStatus(adId, 'rejected', feedbackInput);
    setFeedbackInput('');
    setSelectedAdForReview(null);
  };

  // Platform Metrics
  const totalBudgetSpent = ads.reduce((acc, a) => acc + a.budgetSpent, 0);
  const totalImpressions = ads.reduce((acc, a) => acc + a.impressions, 0);
  const totalViews = ads.reduce((acc, a) => acc + a.views, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 py-3.5 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base">DiscoTQ Platform Admin</span>
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                /admin
              </span>
            </div>
            <p className="text-[11px] text-slate-400">プラットフォーム運営者向け 広告審査＆クリエイター統合管理</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('moderation')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'moderation'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>広告審査キュー</span>
            {pendingAds.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-slate-950 font-bold">
                {pendingAds.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('creators')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'creators'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>全クリエイター一覧 ({creators.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('allAds')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'allAds'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>全広告カタログ ({ads.length})</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Platform Overview Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">審査待ちキュー</span>
            <p className="text-2xl font-bold text-amber-400 mt-1">{pendingAds.length} 件</p>
            <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">平均審査時間: 4分</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">登録広告主・クリエイター</span>
            <p className="text-2xl font-bold text-white mt-1">{creators.length} 社</p>
            <span className="text-[10px] text-emerald-400 font-medium mt-1 inline-block">公認・審査済み</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">プラットフォーム総インプレッション</span>
            <p className="text-2xl font-bold text-blue-400 mt-1">{totalImpressions.toLocaleString()}</p>
            <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">完全視聴: {totalViews.toLocaleString()}</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">累計流通広告費</span>
            <p className="text-2xl font-bold text-slate-100 mt-1">¥{totalBudgetSpent.toLocaleString()}</p>
            <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">リワード還元実行済み</span>
          </div>
        </div>

        {/* Tab 1: Moderation / Ad Review Queue */}
        {activeTab === 'moderation' && (
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
                      <video
                        src={ad.videoUrl}
                        poster={ad.posterUrl}
                        controls
                        className="w-full h-full object-cover"
                      />
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
                          <span className="font-semibold text-emerald-400">+{ad.rewardPoints}pt / ¥{ad.totalBudget.toLocaleString()}</span>
                        </div>
                      </div>

                      {ad.reviewFeedback && (
                        <p className="text-xs text-slate-400 italic">
                          過去の審査メモ: {ad.reviewFeedback}
                        </p>
                      )}
                    </div>

                    {/* Moderation Action Buttons */}
                    <div className="flex flex-col gap-2 w-full lg:w-48 shrink-0">
                      <button
                        onClick={() => handleApprove(ad.id)}
                        className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                      >
                        <Check className="w-4 h-4" />
                        <span>承認して配信開始</span>
                      </button>

                      <button
                        onClick={() => setSelectedAdForReview(selectedAdForReview?.id === ad.id ? null : ad)}
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
                  <h4 className="text-xs font-bold text-rose-400">
                    「{selectedAdForReview.title}」の差戻し理由と修正指示
                  </h4>
                  <button
                    onClick={() => setSelectedAdForReview(null)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    閉じる
                  </button>
                </div>
                <textarea
                  rows={2}
                  placeholder="例: タイトルの表現が景品表示法の優良誤認を招く恐れがあります。客観的根拠の注記を追記してください。"
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500"
                />
                <button
                  onClick={() => handleReject(selectedAdForReview.id)}
                  className="py-2 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  差戻しを送信する
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: All Creators Directory */}
        {activeTab === 'creators' && (
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">全クリエイター・広告主ディレクトリ</h2>
                <p className="text-xs text-slate-400">プラットフォーム参加企業の一覧と健全性モニタリング</p>
              </div>
              <span className="text-xs text-slate-400">計 {creators.length} 社</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">クリエイター・企業</th>
                    <th className="p-3">アカウントランク</th>
                    <th className="p-3">出稿本数</th>
                    <th className="p-3">累計広告費</th>
                    <th className="p-3">平均CTR</th>
                    <th className="p-3">平均完走率</th>
                    <th className="p-3">ステータス</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {creators.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={c.avatar}
                            alt={c.name}
                            className="w-9 h-9 rounded-lg object-cover bg-slate-950 border border-slate-800 shrink-0"
                          />
                          <div>
                            <p className="font-bold text-white">{c.companyName}</p>
                            <p className="text-[11px] text-slate-400">{c.name} ({c.email})</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {c.tier}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-white">
                        {c.totalAdsCreated} 本
                      </td>
                      <td className="p-3 font-bold text-slate-200">
                        ¥{c.totalBudgetSpent.toLocaleString()}
                      </td>
                      <td className="p-3 font-semibold text-emerald-400">
                        {c.averageCtr}%
                      </td>
                      <td className="p-3 font-semibold text-blue-400">
                        {c.averageViewRate}%
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-max">
                          <BadgeCheck className="w-3 h-3" />
                          アクティブ
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: All Ads Catalog */}
        {activeTab === 'allAds' && (
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">全ショート広告カタログ</h2>
                <p className="text-xs text-slate-400">プラットフォーム全体の配信ステータスと強制停止コントロール</p>
              </div>
              <span className="text-xs text-slate-400">計 {ads.length} 本</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">広告</th>
                    <th className="p-3">審査状態</th>
                    <th className="p-3">配信状態</th>
                    <th className="p-3">視聴回数</th>
                    <th className="p-3">LPクリック</th>
                    <th className="p-3">消費予算</th>
                    <th className="p-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {ads.map((ad) => (
                    <tr key={ad.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={ad.posterUrl}
                            alt={ad.title}
                            className="w-10 h-14 rounded-md object-cover bg-slate-950 shrink-0"
                          />
                          <div className="max-w-[220px]">
                            <p className="font-semibold text-white truncate">{ad.title}</p>
                            <p className="text-[11px] text-slate-400">@{ad.brandName}・{ad.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          ad.reviewStatus === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : ad.reviewStatus === 'pending'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {ad.reviewStatus === 'approved' ? '承認済' : ad.reviewStatus === 'pending' ? '審査中' : '差戻し'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          ad.status === 'active'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {ad.status === 'active' ? '配信中' : '停止中'}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-white">{ad.views.toLocaleString()}</td>
                      <td className="p-3 font-semibold text-blue-400">{ad.clicks.toLocaleString()}</td>
                      <td className="p-3 font-semibold text-slate-200">¥{ad.budgetSpent.toLocaleString()}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => toggleAdStatus(ad.id)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          {ad.status === 'active' ? '強制一時停止' : '再開'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};
