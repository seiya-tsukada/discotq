import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, videoApi } from '../../lib/api';
import type { FeedVideo } from '../../types/api';

const PAGE_SIZE = 10;
// 残りがこの件数を切ったら次ページを先読みする
const PREFETCH_THRESHOLD = 3;

// /api/videos/feed からの承認済み動画とカーソルページング
export const useFeedState = () => {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [feedStatus, setFeedStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [feedError, setFeedError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setFeedStatus('loading');
    try {
      const page = await videoApi.feed(cursor, PAGE_SIZE);
      setVideos((prev) => {
        const seen = new Set(prev.map((v) => v.id));
        return [...prev, ...page.items.filter((v) => !seen.has(v.id))];
      });
      setCursor(page.next_cursor);
      setHasMore(page.next_cursor !== null);
      setFeedStatus('idle');
      setFeedError(null);
    } catch (e) {
      setFeedStatus('error');
      setFeedError(errorMessage(e));
    } finally {
      loadingRef.current = false;
    }
  }, [cursor, hasMore]);

  const reloadFeed = useCallback(() => {
    setVideos([]);
    setCursor(null);
    setHasMore(true);
    setCurrentVideoIndex(0);
  }, []);

  // 初回読み込みと、末尾に近づいたときの先読み
  useEffect(() => {
    if (feedStatus !== 'idle' || !hasMore) return;
    if (videos.length === 0 || videos.length - currentVideoIndex <= PREFETCH_THRESHOLD) {
      // feedStatus が idle のときだけ呼ぶため連鎖的な再実行にはならない
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadMore();
    }
  }, [videos.length, currentVideoIndex, hasMore, feedStatus, loadMore]);

  return {
    videos,
    currentVideoIndex,
    setCurrentVideoIndex,
    hasMoreVideos: hasMore,
    feedStatus,
    feedError,
    loadMoreVideos: loadMore,
    reloadFeed,
  };
};
