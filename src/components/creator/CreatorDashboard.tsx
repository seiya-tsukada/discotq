import React from 'react';
import { AdItem } from '../../types';
import { CreatorKpiSummary } from './CreatorKpiSummary';
import { CreativeImprovementPanel } from './CreativeImprovementPanel';
import { CreatorAdList } from './CreatorAdList';

interface CreatorDashboardProps {
  ads: AdItem[];
  onUploadClick: () => void;
  onToggleStatus: (adId: string) => void;
  onDelete: (adId: string) => void;
}

export const CreatorDashboard: React.FC<CreatorDashboardProps> = ({ ads, onUploadClick, onToggleStatus, onDelete }) => {
  return (
    <div className="space-y-6">
      {/* KPI Summary */}
      <CreatorKpiSummary ads={ads} />

      {/* Creative Improvement & Optimization Section */}
      <CreativeImprovementPanel ads={ads} onUploadClick={onUploadClick} />

      {/* Campaign Management List */}
      <CreatorAdList ads={ads} onUploadClick={onUploadClick} onToggleStatus={onToggleStatus} onDelete={onDelete} />
    </div>
  );
};
