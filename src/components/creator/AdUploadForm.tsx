import React from 'react';
import { Upload } from 'lucide-react';
import { CreatorAdForm } from './useCreatorAdForm';
import { CreativeMediaSection } from './CreativeMediaSection';
import { AdCopySection } from './AdCopySection';
import { LandingOfferSection } from './LandingOfferSection';
import { RewardBudgetSection } from './RewardBudgetSection';

interface AdUploadFormProps {
  form: CreatorAdForm;
  onCancel: () => void;
}

export const AdUploadForm: React.FC<AdUploadFormProps> = ({ form, onCancel }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-xl font-bold text-white">新しいショート広告の入稿・LP設定</h2>
        <p className="text-xs text-slate-400 mt-1">
          動画・静止画クリエイティブをアップロードし、訴求タイトル、CTA、アプリ内LP詳細を設定します。
        </p>
      </div>

      <form onSubmit={form.handleSubmitAd} className="space-y-6">
        {/* Media Upload Box */}
        <CreativeMediaSection form={form} />

        {/* Title & Copy Settings */}
        <AdCopySection form={form} />

        {/* LP & Offer Details */}
        <LandingOfferSection form={form} />

        {/* Reward & Budget */}
        <RewardBudgetSection form={form} />

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={form.isSubmitting}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm shadow transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>{form.isSubmitting ? '審査申請中...' : '広告をアップロードして審査に提出する'}</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="py-3 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors border border-slate-800 cursor-pointer"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
};
