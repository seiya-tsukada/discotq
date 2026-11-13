import { useCallback, useEffect, useState } from 'react';
import { adminApi, errorMessage } from '../../lib/api';
import type { AdminVideo, VideoSource, VideoStatus } from '../../types/api';

const PAGE_SIZE = 50;

export const useAdminVideos = (status: VideoStatus | '', source: VideoSource | '') => {
  const [items, setItems] = useState<AdminVideo[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (offset = 0) => {
      setLoading(true);
      try {
        const res = await adminApi.list({ status, source, limit: PAGE_SIZE, offset });
        setItems((prev) => (offset === 0 ? res.items : [...prev, ...res.items]));
        setNextOffset(res.next_offset);
        setError(null);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [status, source]
  );

  useEffect(() => {
    // フィルタ変更時に一覧を取得する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(0);
  }, [load]);

  // 審査操作の結果を一覧に反映する（フィルタ条件から外れたら除外）
  const applyUpdate = useCallback(
    (video: AdminVideo) => {
      setItems((prev) =>
        status && video.status !== status
          ? prev.filter((v) => v.id !== video.id)
          : prev.map((v) => (v.id === video.id ? video : v))
      );
    },
    [status]
  );

  return {
    items,
    loading,
    error,
    reload: () => load(0),
    loadMore: nextOffset !== null ? () => load(nextOffset) : null,
    applyUpdate,
  };
};
