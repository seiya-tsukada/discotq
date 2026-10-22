import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CreatorHeader, CreatorTab } from './CreatorHeader';
import { CreatorDashboard } from './CreatorDashboard';
import { AdUploadForm } from './AdUploadForm';
import { useCreatorAdForm } from './useCreatorAdForm';

export const CreatorPortal: React.FC = () => {
  const { ads, toggleAdStatus, deleteAd } = useApp();
  const [activeTab, setActiveTab] = useState<CreatorTab>('dashboard');

  // Form State (タブ切替後も入力内容を保持するため親で管理)
  const form = useCreatorAdForm(() => setActiveTab('dashboard'));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Top Navigation Bar */}
      <CreatorHeader activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Tab 1: Dashboard & Improvement Center */}
        {activeTab === 'dashboard' && (
          <CreatorDashboard
            ads={ads}
            onUploadClick={() => setActiveTab('upload')}
            onToggleStatus={toggleAdStatus}
            onDelete={deleteAd}
          />
        )}

        {/* Tab 2: Upload / Creative Studio Form */}
        {activeTab === 'upload' && <AdUploadForm form={form} onCancel={() => setActiveTab('dashboard')} />}
      </main>
    </div>
  );
};
