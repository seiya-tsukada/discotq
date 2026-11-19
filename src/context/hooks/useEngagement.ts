import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeedVideo } from '../../types/api';
import { engagementApi, errorMessage } from '../../lib/api';
import { setIdIn } from '../../lib/user';
import { ShowNotification } from './useNotification';

interface Deps {
  // サーバーのログイン状態（AuthContext）。ユーザーが切り替わったら自分のいいね・保存を取り直す
  authUserId: string | null;
  authReady: boolean;
  showNotification: ShowNotification;
}

// いいね・保存はサーバーに保存する（ログイン中はアカウント、未ログインは端末の匿名 ID に紐づく）。
// コメント本体はコメント欄（useComments）が読み書きし、ここでは件数表示だけを持つ
export const useEngagement = ({ authUserId, authReady, showNotification }: Deps) => {
  const [likedVideoIds, setLikedVideoIds] = useState<string[]>([]);
  const [bookmarkedVideoIds, setBookmarkedVideoIds] = useState<string[]>([]);
  // 自分の操作で変わった最新のいいね数。無ければフィード取得時の like_count を使う
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  // コメント欄で取得・投稿・削除した後の最新のコメント数。無ければフィード取得時の comment_count を使う
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  // 同じ動画への連打で、リクエストが入れ違わないようにする
  const pending = useRef(new Set<string>());

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    engagementApi
      .mine()
      .then((res) => {
        if (cancelled) return;
        setLikedVideoIds(res.liked_video_ids);
        setBookmarkedVideoIds(res.bookmarked_video_ids);
      })
      .catch((e: unknown) => {
        // 取れなくてもフィードは見られるので、表示を未登録のままにして記録だけ残す
        if (!cancelled) console.error(e);
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, authUserId]);

  const likeCountFor = (video: FeedVideo) => likeCounts[video.id] ?? video.like_count;
  const commentCountFor = (video: FeedVideo) => commentCounts[video.id] ?? video.comment_count;
  const setCommentCount = useCallback((videoId: string, count: number) => {
    setCommentCounts((c) => (c[videoId] === count ? c : { ...c, [videoId]: count }));
  }, []);

  const toggleLike = async (video: FeedVideo) => {
    const key = `like:${video.id}`;
    if (pending.current.has(key)) return;
    pending.current.add(key);
    const wasLiked = likedVideoIds.includes(video.id);
    const prevCount = likeCountFor(video);
    // 先に表示を切り替え、失敗したら戻す
    setLikedVideoIds((ids) => setIdIn(ids, video.id, !wasLiked));
    setLikeCounts((c) => ({ ...c, [video.id]: Math.max(0, prevCount + (wasLiked ? -1 : 1)) }));
    try {
      const res = wasLiked ? await engagementApi.unlike(video.id) : await engagementApi.like(video.id);
      setLikedVideoIds((ids) => setIdIn(ids, video.id, res.liked));
      setLikeCounts((c) => ({ ...c, [video.id]: res.like_count }));
    } catch (e) {
      setLikedVideoIds((ids) => setIdIn(ids, video.id, wasLiked));
      setLikeCounts((c) => ({ ...c, [video.id]: prevCount }));
      showNotification(`いいねできませんでした: ${errorMessage(e)}`, undefined, 'warning');
    } finally {
      pending.current.delete(key);
    }
  };

  const toggleBookmark = async (video: FeedVideo) => {
    const key = `bookmark:${video.id}`;
    if (pending.current.has(key)) return;
    pending.current.add(key);
    const wasBookmarked = bookmarkedVideoIds.includes(video.id);
    setBookmarkedVideoIds((ids) => setIdIn(ids, video.id, !wasBookmarked));
    try {
      const res = wasBookmarked ? await engagementApi.unbookmark(video.id) : await engagementApi.bookmark(video.id);
      setBookmarkedVideoIds((ids) => setIdIn(ids, video.id, res.bookmarked));
      showNotification(res.bookmarked ? '動画をマイリストに保存しました' : '保存を解除しました', undefined, 'info');
    } catch (e) {
      setBookmarkedVideoIds((ids) => setIdIn(ids, video.id, wasBookmarked));
      showNotification(`保存できませんでした: ${errorMessage(e)}`, undefined, 'warning');
    } finally {
      pending.current.delete(key);
    }
  };

  return {
    likedVideoIds,
    bookmarkedVideoIds,
    likeCountFor,
    toggleLike,
    toggleBookmark,
    commentCountFor,
    setCommentCount,
  };
};
