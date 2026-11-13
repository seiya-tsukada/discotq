-- =============================================================================
-- 04_purge_candidates.sql
-- 用途     : 却下・削除・失敗から30日経過した動画の一覧（R2 から物理削除する対象）
-- 実行頻度 : 週1回
-- 破壊的操作: 一覧は参照のみ。後半の DB 行削除は begin/rollback の雛形
-- 手順     : ① 一覧を出力 → ② R2 からキーを削除 → ③ 必要なら DB 行を削除（監査ログは残る）
-- =============================================================================

-- ① R2 削除対象（private の原本・サムネ。public は却下・削除時点で消えている想定）
select v.id, v.status, v.bucket, v.object_key, v.thumb_key,
       coalesce(v.deleted_at, v.updated_at) as since
from discotq.videos v
where (
        (v.status = 'deleted'  and v.deleted_at < now() - interval '30 days')
     or (v.status in ('rejected', 'failed') and v.updated_at < now() - interval '30 days')
      )
order by since;

-- 念のため: public_url が残っているもの（05_orphan_check でも検出）
select id, status, public_url
from discotq.videos
where status in ('deleted', 'rejected', 'failed')
  and public_url is not null;

-- ③ DB 行の削除（雛形）。video_reviews は on delete cascade で消える
begin;

with purged as (
  delete from discotq.videos v
  where (
          (v.status = 'deleted'  and v.deleted_at < now() - interval '30 days')
       or (v.status in ('rejected', 'failed') and v.updated_at < now() - interval '30 days')
        )
    and v.public_url is null
  returning v.id, v.bucket, v.object_key
)
insert into discotq.audit_logs (actor_id, actor_type, action, target_type, target_id, payload)
select null, 'system', 'video.purge', 'video', id::text,
       jsonb_build_object('bucket', bucket, 'object_key', object_key)
from purged;

rollback;  -- R2 側の削除が終わってから commit; に変更して実行
