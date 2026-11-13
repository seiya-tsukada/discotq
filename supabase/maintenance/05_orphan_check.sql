-- =============================================================================
-- 05_orphan_check.sql
-- 用途     : DB 上の不整合の検出
-- 実行頻度 : 日次
-- 破壊的操作: なし（参照のみ）。各クエリは 0 行が正常
-- =============================================================================

-- public_url があるのに approved でない（public バケットに残っている可能性）
select 'public_url_but_not_approved' as issue, id, status, public_url
from discotq.videos
where public_url is not null and status <> 'approved';

-- approved なのに approved_at / approved_by が無い（運営の自動承認は approved_by あり）
select 'approved_without_metadata' as issue, id, status, approved_at, approved_by
from discotq.videos
where status = 'approved' and (approved_at is null or public_url is null);

-- deleted なのに deleted_at が無い / deleted 以外なのに deleted_at がある
select 'deleted_at_mismatch' as issue, id, status, deleted_at
from discotq.videos
where (status = 'deleted') <> (deleted_at is not null);

-- 審査履歴の無い approved / rejected
select 'no_review_record' as issue, v.id, v.status
from discotq.videos v
where v.status in ('approved', 'rejected')
  and not exists (select 1 from discotq.video_reviews r where r.video_id = v.id);

-- 投稿者を辿れないユーザー投稿（制約で防いでいるが、ユーザー削除で set null された場合）
select 'user_video_without_owner' as issue, id, status
from discotq.videos
where source = 'user' and uploader_user_id is null and anonymous_id is null;

-- 期限切れのまま残っているセッション・トークン（掃除対象）
select 'expired_sessions' as issue, count(*) from discotq.sessions where expires_at < now();
select 'expired_email_tokens' as issue, count(*) from discotq.email_tokens where expires_at < now() - interval '7 days';
