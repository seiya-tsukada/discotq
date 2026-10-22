import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AdCategory, AdLandingPage } from '../../types';
import {
  CREATOR_FORM_DEFAULTS,
  DEFAULT_COUPON_CODE,
  DEFAULT_MIN_WATCH_SECONDS,
  DEFAULT_OFFER_EXPIRES_AT,
  PRESET_CREATIVES,
} from '../../constants/ads';
import { DEFAULT_LP_READ_REWARD_POINTS } from '../../constants/rewards';
import { AD_SUBMIT_DELAY_MS } from '../../constants/timing';

export type PresetCreative = (typeof PRESET_CREATIVES)[number];

export interface CreatorAdForm {
  brandName: string;
  setBrandName: (value: string) => void;
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  category: AdCategory;
  setCategory: (value: AdCategory) => void;
  tags: string;
  setTags: (value: string) => void;
  videoUrl: string;
  ctaText: string;
  setCtaText: (value: string) => void;
  rewardPoints: number;
  setRewardPoints: (value: number) => void;
  budget: number;
  setBudget: (value: number) => void;
  externalUrl: string;
  setExternalUrl: (value: string) => void;
  couponCode: string;
  setCouponCode: (value: string) => void;
  discountText: string;
  setDiscountText: (value: string) => void;
  isSubmitting: boolean;
  uploadedFileName: string | null;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelectPreset: (preset: PresetCreative) => void;
  handleSubmitAd: (e: React.FormEvent) => void;
}

// 入稿フォームの状態。タブ切替でフォームがアンマウントされても入力内容を保持するため、
// CreatorPortal (親) 側で呼び出す
export const useCreatorAdForm = (onSubmitted: () => void): CreatorAdForm => {
  const { createNewAd } = useApp();

  // Form State
  const [brandName, setBrandName] = useState<string>(CREATOR_FORM_DEFAULTS.brandName);
  const [brandLogo] = useState<string>(CREATOR_FORM_DEFAULTS.brandLogo);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<AdCategory>(CREATOR_FORM_DEFAULTS.category);
  const [tags, setTags] = useState<string>(CREATOR_FORM_DEFAULTS.tags);
  const [videoUrl, setVideoUrl] = useState<string>(PRESET_CREATIVES[0].url);
  const [posterUrl, setPosterUrl] = useState<string>(PRESET_CREATIVES[0].poster);
  const [ctaText, setCtaText] = useState<string>(CREATOR_FORM_DEFAULTS.ctaText);
  const [rewardPoints, setRewardPoints] = useState<number>(CREATOR_FORM_DEFAULTS.rewardPoints);
  const [budget, setBudget] = useState<number>(CREATOR_FORM_DEFAULTS.budget);
  const [externalUrl, setExternalUrl] = useState<string>(CREATOR_FORM_DEFAULTS.externalUrl);
  const [couponCode, setCouponCode] = useState<string>(CREATOR_FORM_DEFAULTS.couponCode);
  const [discountText, setDiscountText] = useState<string>(CREATOR_FORM_DEFAULTS.discountText);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Handle Mock File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      // Create local object URL for preview
      const objectUrl = URL.createObjectURL(file);
      setVideoUrl(objectUrl);
      setPosterUrl(CREATOR_FORM_DEFAULTS.uploadedPosterUrl);
    }
  };

  const handleSelectPreset = (preset: PresetCreative) => {
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
        {
          title: '独自設計と徹底した品質管理',
          desc: '厳しい検査基準をクリアした安心のプロダクト',
          icon: 'ShieldCheck',
        },
        { title: '公式限定サポート体制', desc: '専任スタッフによる万全のカスタマーサポート', icon: 'Zap' },
        { title: '高いユーザー満足度', desc: 'ユーザーアンケートで95%以上の高評価を獲得', icon: 'Star' },
      ],
      specialOffer: {
        couponCode: couponCode || DEFAULT_COUPON_CODE,
        discount: discountText || '特別優待適用',
        expiresAt: DEFAULT_OFFER_EXPIRES_AT,
      },
      reviews: [
        {
          name: '公式導入ユーザー',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80',
          rating: 5,
          comment: '動画広告で要点が分かりやすく、スムーズに利用できました。',
        },
      ],
      faqs: [{ q: '利用開始の手続きについて', a: '公式ウェブサイトより最短3分でお手続き可能です。' }],
      externalUrl: externalUrl || CREATOR_FORM_DEFAULTS.fallbackExternalUrl,
      ctaButtonText: '公式サイトで詳細を確認する',
      readRewardPoints: DEFAULT_LP_READ_REWARD_POINTS,
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
        tags: formattedTags.length > 0 ? formattedTags : [CREATOR_FORM_DEFAULTS.fallbackTag],
        videoUrl,
        posterUrl,
        category,
        ctaText,
        ctaType: 'primary',
        rewardPoints: Number(rewardPoints),
        minWatchSeconds: DEFAULT_MIN_WATCH_SECONDS,
        soundName: `${brandName} Official Brand Audio`,
        soundAuthor: `${brandName} Sound Studio`,
        landingPage,
        advertiserId: CREATOR_FORM_DEFAULTS.advertiserId,
        creatorName: brandName,
        creatorEmail: CREATOR_FORM_DEFAULTS.creatorEmail,
        totalBudget: budget,
        status: 'paused', // initially paused until approved
      });

      setIsSubmitting(false);
      onSubmitted();
    }, AD_SUBMIT_DELAY_MS);
  };

  return {
    brandName,
    setBrandName,
    title,
    setTitle,
    description,
    setDescription,
    category,
    setCategory,
    tags,
    setTags,
    videoUrl,
    ctaText,
    setCtaText,
    rewardPoints,
    setRewardPoints,
    budget,
    setBudget,
    externalUrl,
    setExternalUrl,
    couponCode,
    setCouponCode,
    discountText,
    setDiscountText,
    isSubmitting,
    uploadedFileName,
    handleFileUpload,
    handleSelectPreset,
    handleSubmitAd,
  };
};
