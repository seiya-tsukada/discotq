-- =============================================================================
-- 06_anonymous_abuse_check.sql
-- 用途     : 匿名投稿の濫用検出（anonymous_id / IP ハッシュ別・日別の投稿数上位）
-- 実行頻度 : 日次
-- 破壊的操作: なし（参照のみ）
-- 備考     : 投稿数は intent 時点で数える（failed になったものも含む = 連打の検出）
-- =============================================================================

-- anonymous_id × 日 の投稿数上位（直近7日）
select anonymous_id,
       date_trunc('day', created_at at time zone 'Asia/Tokyo') as day_jst,
       count(*)                                          as uploads,
       count(*) filter (where status = 'rejected')       as rejected,
       count(*) filter (where status = 'failed')         as failed
from discotq.videos
where source = 'user'
  and anonymous_id is not null
  and created_at > now() - interval '7 days'
group by 1, 2
order by uploads desc
limit 50;

-- IP ハッシュ × 日 の投稿数上位（複数の anonymous_id を使い分けている端末の検出）
select uploader_ip_hash,
       date_trunc('day', created_at at time zone 'Asia/Tokyo') as day_jst,
       count(*)                     as uploads,
       count(distinct anonymous_id) as anonymous_ids
from discotq.videos
where source = 'user'
  and uploader_ip_hash is not null
  and created_at > now() - interval '7 days'
group by 1, 2
order by uploads desc
limit 50;

-- 却下率の高い anonymous_id（直近30日、5件以上）
select anonymous_id,
       count(*)                                                        as uploads,
       count(*) filter (where status = 'rejected')                     as rejected,
       round(100.0 * count(*) filter (where status = 'rejected') / count(*), 1) as reject_rate_pct
from discotq.videos
where source = 'user'
  and anonymous_id is not null
  and created_at > now() - interval '30 days'
group by anonymous_id
having count(*) >= 5
order by reject_rate_pct desc, uploads desc
limit 50;

-- ログイン失敗の多い IP ハッシュ（直近24時間）
select ip_hash, count(*) as failed_logins, count(distinct email_lower) as emails
from discotq.login_attempts
where not succeeded and created_at > now() - interval '24 hours'
group by ip_hash
order by failed_logins desc
limit 50;
