import React from 'react';
import { FileText } from 'lucide-react';
import { AdCategory } from '../../types';
import { CreatorAdForm } from './useCreatorAdForm';

interface AdCopySectionProps {
  form: CreatorAdForm;
}

export const AdCopySection: React.FC<AdCopySectionProps> = ({ form }) => {
  const {
    brandName,
    setBrandName,
    category,
    setCategory,
    title,
    setTitle,
    description,
    setDescription,
    ctaText,
    setCtaText,
    tags,
    setTags,
  } = form;

  return (
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
            onChange={(e) => setCategory(e.target.value as AdCategory)}
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
  );
};
