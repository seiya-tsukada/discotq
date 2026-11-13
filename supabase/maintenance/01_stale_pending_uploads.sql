-- =============================================================================
-- 01_stale_pending_uploads.sql
-- 用途     : 24時間以上 pending_upload のまま（ブラウザからの PUT や complete が来なかった）
--            動画を failed に更新し、R2 側の削除対象キー一覧を出力する
-- 実行頻度 : 1日1回
-- 破壊的操作: あり（videos.status を更新）。既定は rollback。内容を確認してから commit に書き換える
-- 備考     : 出力されたキーは private バケットに中途半端なオブジェクトが残っている可能性がある。
--            aws s3 rm / rclone 等で削除する（存在しなければ何もしない）
-- =============================================================================

-- ① 対象の確認（参照のみ）
select id, source, bucket, object_key, thumb_key, created_at
from discotq.videos
where status = 'pending_upload'
  and created_at < now() - interval '24 hours'
order by created_at;

-- ② 更新（雛形）
begin;

with stale as (
  update discotq.videos
     set status = 'failed'
   where status = 'pending_upload'
     and created_at < now() - interval '24 hours'
  returning id, bucket, object_key, thumb_key
), logged as (
  insert into discotq.audit_logs (actor_id, actor_type, action, target_type, target_id, payload)
  select null, 'system', 'video.mark_failed_stale', 'video', id::text,
         jsonb_build_object('reason', 'pending_upload > 24h')
  from stale
)
-- R2 削除対象キー一覧
select bucket, object_key as key from stale
union all
select bucket, thumb_key from stale where thumb_key is not null
order by 1, 2;

rollback;  -- 問題なければ commit; に変更して実行
