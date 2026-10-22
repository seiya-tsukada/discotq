import React from 'react';
import { ExternalLink } from 'lucide-react';
import { CreatorAdForm } from './useCreatorAdForm';

interface LandingOfferSectionProps {
  form: CreatorAdForm;
}

export const LandingOfferSection: React.FC<LandingOfferSectionProps> = ({ form }) => {
  const { externalUrl, setExternalUrl, couponCode, setCouponCode, discountText, setDiscountText } = form;

  return (
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
  );
};
