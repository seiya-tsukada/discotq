-- =============================================================================
-- 02_review_queue_stats.sql
-- 用途     : 審査状況の把握（ステータス別件数、審査待ちの最古日時、平均審査時間）
-- 実行頻度 : 随時 / 日次レポート
-- 破壊的操作: なし（参照のみ）
-- =============================================================================

-- ステータス別・投稿元別の件数
select status, source, count(*) as videos
from discotq.videos
group by status, source
order by status, source;

-- 審査待ちの件数と最古の投稿日時
select count(*)                     as in_review,
       min(created_at)              as oldest_created_at,
       now() - min(created_at)      as oldest_waiting
from discotq.videos
where status = 'in_review';

-- 平均審査時間（投稿〜最初の審査操作まで、直近30日）
with first_review as (
  select r.video_id, min(r.created_at) as reviewed_at
  from discotq.video_reviews r
  where r.action in ('approve', 'reject')
  group by r.video_id
)
select count(*)                                          as reviewed_videos,
       avg(fr.reviewed_at - v.created_at)                as avg_review_time,
       percentile_cont(0.5) within group (
         order by extract(epoch from fr.reviewed_at - v.created_at)
       ) * interval '1 second'                           as median_review_time
from first_review fr
join discotq.videos v on v.id = fr.video_id
where fr.reviewed_at > now() - interval '30 days'
  and v.source = 'user';

-- 審査者別の操作件数（直近30日）
select coalesce(u.email, '(deleted user)') as reviewer, r.action, count(*) as actions
from discotq.video_reviews r
left join discotq.users u on u.id = r.reviewer_id
where r.created_at > now() - interval '30 days'
group by 1, 2
order by 1, 2;
