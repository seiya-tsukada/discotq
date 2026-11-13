-- =============================================================================
-- 03_storage_usage.sql
-- 用途     : バケット別の保存量・件数（R2 無料枠 10GB/月 の監視用）
-- 実行頻度 : 週1回
-- 破壊的操作: なし（参照のみ）
-- 備考     : DB 上の記録からの推計値。サムネイルのサイズは含まない（1件あたり数十KB程度）。
--            正確な値は Cloudflare ダッシュボードの R2 > Metrics を参照
-- =============================================================================

-- private バケット（原本。failed / deleted でもパージ前なら残っている）
select bucket,
       count(*)                                    as objects,
       pg_size_pretty(sum(size_bytes))             as total_size,
       round(sum(size_bytes) / 1024.0 ^ 3, 3)      as total_gb
from discotq.videos
where status <> 'pending_upload'
group by bucket
order by bucket;

-- public バケット（承認済みのコピー）
select 'public'                                    as bucket,
       count(*)                                    as objects,
       pg_size_pretty(coalesce(sum(size_bytes), 0)) as total_size,
       round(coalesce(sum(size_bytes), 0) / 1024.0 ^ 3, 3) as total_gb
from discotq.videos
where public_url is not null;

-- ステータス別の内訳
select status, count(*) as videos, pg_size_pretty(sum(size_bytes)) as total_size
from discotq.videos
group by status
order by sum(size_bytes) desc;
