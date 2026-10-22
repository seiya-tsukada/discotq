import { AdItem } from '../../types';
import { INITIAL_ADS } from '../../data/mockAds';
import { LOCAL_STORAGE_KEY_ADS } from '../../constants/storage';
import { applyReviewDecision, buildNewAd, NewAdInput, ReviewDecision, updateAdById } from '../../lib/ads';
import { usePersistentState } from './usePersistentState';
import { ShowNotification } from './useNotification';

// 広告データと、クリエイター・運営者による広告管理アクション
export const useAdsState = (showNotification: ShowNotification) => {
  const [ads, setAds] = usePersistentState<AdItem[]>(LOCAL_STORAGE_KEY_ADS, () => INITIAL_ADS);

  const createNewAd = (input: NewAdInput) => {
    const newAd = buildNewAd(input);
    setAds((prev) => [newAd, ...prev]);
    showNotification(`広告「${newAd.title}」をアップロード・申請しました（審査中）`, undefined, 'success');
  };

  const updateAdCreative = (adId: string, updates: Partial<AdItem>) => {
    setAds((prev) => updateAdById(prev, adId, (ad) => ({ ...ad, ...updates })));
    showNotification('広告設定を更新しました', undefined, 'success');
  };

  const toggleAdStatus = (adId: string) => {
    setAds((prev) =>
      updateAdById(prev, adId, (ad) => ({ ...ad, status: ad.status === 'active' ? 'paused' : 'active' }))
    );
  };

  const deleteAd = (adId: string) => {
    setAds((prev) => prev.filter((ad) => ad.id !== adId));
    showNotification('広告を削除しました', undefined, 'info');
  };

  const updateAdReviewStatus = (adId: string, decision: ReviewDecision, feedback?: string) => {
    setAds((prev) => updateAdById(prev, adId, (ad) => applyReviewDecision(ad, decision, feedback)));
    showNotification(
      decision === 'approved' ? '広告を承認し配信開始しました' : '広告を差戻ししました',
      undefined,
      decision === 'approved' ? 'success' : 'warning'
    );
  };

  return { ads, setAds, createNewAd, updateAdCreative, toggleAdStatus, deleteAd, updateAdReviewStatus };
};
