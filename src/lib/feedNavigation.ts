// フィードの前後移動のルール。並び順そのものはサーバーのフィード戦略（backend/app/services/feed.py）が決め、
// ここは「読み込み済みの一覧のどこへ動くか」だけを扱う

export interface FeedPosition {
  index: number;
  // 読み込み済みの件数
  count: number;
  // サーバーにまだ続きがあるか
  hasMore: boolean;
}

// 次の操作: 指定の位置へ移る / 続きを読み込む / 動けない
export type FeedMove = { type: 'go'; index: number } | { type: 'loadMore' } | { type: 'none' };

// 全件を読み込み済みで 2 件以上あれば、端からもう一方の端へ回る（終わりを感じさせない）
const canLoop = ({ count, hasMore }: FeedPosition) => !hasMore && count > 1;

export const nextMove = (pos: FeedPosition): FeedMove => {
  if (pos.index < pos.count - 1) return { type: 'go', index: pos.index + 1 };
  // 続きがあれば読み込む（読み込み後にもう一度押すと進める）
  if (pos.hasMore) return { type: 'loadMore' };
  if (canLoop(pos)) return { type: 'go', index: 0 };
  return { type: 'none' };
};

export const prevMove = (pos: FeedPosition): FeedMove => {
  if (pos.index > 0) return { type: 'go', index: pos.index - 1 };
  if (canLoop(pos)) return { type: 'go', index: pos.count - 1 };
  return { type: 'none' };
};
