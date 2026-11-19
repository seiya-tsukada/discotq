import { useEffect, useState } from 'react';
import type { VideoComment } from '../../types/api';
import { commentApi } from '../../lib/api';

interface Options {
  videoId: string | null;
  // コメント欄が開いている間だけ取得する
  enabled: boolean;
  // ログインユーザーが変わると「自分のコメント」「削除できるか」が変わるので取り直す
  viewerId: string | null;
  // 件数が変わったら、フィードのコメント数表示にも反映する
  onCountChange: (videoId: string, count: number) => void;
}

interface Loaded {
  // どの動画・どの閲覧者で取得した結果か。今の表示対象と違えば読み込み中として扱う
  key: string;
  items: VideoComment[];
  nextCursor: string | null;
  totalCount: number;
  error: unknown;
}

// コメント欄 1 つ分の一覧・投稿・削除。loadMore / post / remove の失敗は throw し、表示は呼び出し側で行う
export const useComments = ({ videoId, enabled, viewerId, onCountChange }: Options) => {
  const key = enabled && videoId ? `${videoId}|${viewerId ?? ''}` : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // 再読み込みボタンで同じ key のまま取り直すためのカウンター
  const [reloadTick, setReloadTick] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!key || !videoId) return;
    let cancelled = false;
    commentApi
      .list(videoId)
      .then((res) => {
        if (cancelled) return;
        setLoaded({ key, items: res.items, nextCursor: res.next_cursor, totalCount: res.total_count, error: null });
        onCountChange(videoId, res.total_count);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoaded({ key, items: [], nextCursor: null, totalCount: 0, error: e });
      });
    return () => {
      // 閉じた・切り替えた後に届いた応答は捨てる
      cancelled = true;
    };
  }, [key, videoId, reloadTick, onCountChange]);

  const current = loaded && loaded.key === key ? loaded : null;
  const status: 'loading' | 'ready' | 'error' = !current ? 'loading' : current.error ? 'error' : 'ready';

  // 取得済みの結果を、まだ同じ表示対象のときだけ書き換える
  const update = (forKey: string, fn: (prev: Loaded) => Loaded) =>
    setLoaded((prev) => (prev && prev.key === forKey ? fn(prev) : prev));

  const changeCount = (forKey: string, id: string, count: number) => {
    update(forKey, (prev) => ({ ...prev, totalCount: count }));
    onCountChange(id, count);
  };

  const reload = () => {
    setLoaded(null);
    setReloadTick((n) => n + 1);
  };

  const loadMore = async () => {
    if (!key || !videoId || !current?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await commentApi.list(videoId, current.nextCursor);
      update(key, (prev) => ({
        ...prev,
        // 読み込みの間に投稿したものと重ならないようにする
        items: [...prev.items, ...res.items.filter((c) => !prev.items.some((p) => p.id === c.id))],
        nextCursor: res.next_cursor,
      }));
      changeCount(key, videoId, res.total_count);
    } finally {
      setLoadingMore(false);
    }
  };

  const post = async (body: string) => {
    if (!key || !videoId || !current) return;
    const created = await commentApi.create(videoId, body);
    update(key, (prev) => ({ ...prev, items: [created, ...prev.items] }));
    changeCount(key, videoId, current.totalCount + 1);
  };

  const remove = async (commentId: string) => {
    if (!key || !videoId || !current) return;
    await commentApi.remove(commentId);
    update(key, (prev) => ({ ...prev, items: prev.items.filter((c) => c.id !== commentId) }));
    changeCount(key, videoId, Math.max(0, current.totalCount - 1));
  };

  return {
    items: current?.items ?? [],
    totalCount: current?.totalCount ?? 0,
    hasMore: Boolean(current?.nextCursor),
    status,
    error: current?.error ?? null,
    loadingMore,
    reload,
    loadMore,
    post,
    remove,
  };
};
