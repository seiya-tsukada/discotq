import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AdItem } from '../../types';
import { AdminHeader, AdminTab } from './AdminHeader';
import { PlatformMetrics } from './PlatformMetrics';
import { ModerationQueue } from './ModerationQueue';
import { CreatorsTable } from './CreatorsTable';
import { AllAdsTable } from './AllAdsTable';

export const AdminPortal: React.FC = () => {
  const { ads, creators, updateAdReviewStatus } = useApp();
  const [activeTab, setActiveTab] = useState<AdminTab>('moderation');
  // 差戻し対象と入力内容はタブを切り替えても保持する
  const [selectedAdForReview, setSelectedAdForReview] = useState<AdItem | null>(null);
  const [feedbackInput, setFeedbackInput] = useState('');

  const pendingAds = ads.filter((a) => a.reviewStatus === 'pending');

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      <AdminHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingCount={pendingAds.length}
        creatorsCount={creators.length}
        adsCount={ads.length}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <PlatformMetrics ads={ads} pendingCount={pendingAds.length} creatorsCount={creators.length} />

        {activeTab === 'moderation' && (
          <ModerationQueue
            pendingAds={pendingAds}
            selectedAdForReview={selectedAdForReview}
            onSelectAdForReview={setSelectedAdForReview}
            feedbackInput={feedbackInput}
            onFeedbackInputChange={setFeedbackInput}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}

        {activeTab === 'creators' && <CreatorsTable creators={creators} />}

        {activeTab === 'allAds' && <AllAdsTable ads={ads} />}
      </main>
    </div>
  );
};
