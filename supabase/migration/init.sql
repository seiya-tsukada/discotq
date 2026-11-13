-- =============================================================================
-- DiscoTQ 初期スキーマ
--
-- 適用方法: Supabase の SQL Editor で実行するか、
--   psql "$DATABASE_URL_DIRECT" -v ON_ERROR_STOP=1 -f supabase/migration/init.sql
-- （DDL はトランザクションプーラー(6543)ではなく、直接接続(5432)かセッションプーラーで流すこと）
--
-- 方針:
--   * すべて専用スキーマ discotq に作る（public や auth には触れない）
--   * 認証は Supabase Auth を使わず discotq.users / discotq.sessions で独自に持つ
--   * 全テーブルで RLS を有効化し、anon / authenticated には一切権限を付与しない。
--     アクセスはバックエンド (FastAPI) の DB 接続ユーザー経由のみ。
--   * 何度流しても壊れないよう、可能な限り if not exists で書く
-- =============================================================================

begin;

set local client_min_messages = warning;

create schema if not exists discotq;

-- -----------------------------------------------------------------------------
-- 共通: updated_at 自動更新トリガー
-- -----------------------------------------------------------------------------
create or replace function discotq.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- users: DiscoTQ 独自のユーザー（Supabase Auth の auth.users とは無関係）
-- -----------------------------------------------------------------------------
create table if not exists discotq.users (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  password_hash     text not null,              -- argon2id
  display_name      text,
  email_verified_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint users_email_format check (position('@' in email) > 1),
  constraint users_display_name_len check (display_name is null or char_length(display_name) <= 50)
);
-- メールアドレスは大文字小文字を区別せず一意
create unique index if not exists users_email_lower_uq on discotq.users (lower(email));

drop trigger if exists users_set_updated_at on discotq.users;
create trigger users_set_updated_at
  before update on discotq.users
  for each row execute function discotq.set_updated_at();

-- -----------------------------------------------------------------------------
-- sessions: httpOnly Cookie に入れるセッショントークンの SHA-256 を保存
-- -----------------------------------------------------------------------------
create table if not exists discotq.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references discotq.users (id) on delete cascade,
  token_hash   text not null unique,
  ip_hash      text,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null
);
create index if not exists sessions_user_id_idx on discotq.sessions (user_id);
create index if not exists sessions_expires_at_idx on discotq.sessions (expires_at);

-- -----------------------------------------------------------------------------
-- email_tokens: メール確認 / パスワード再設定のワンタイムトークン（SHA-256 を保存）
-- -----------------------------------------------------------------------------
create table if not exists discotq.email_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references discotq.users (id) on delete cascade,
  purpose     text not null,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now(),
  constraint email_tokens_purpose_chk check (purpose in ('verify_email', 'password_reset'))
);
create index if not exists email_tokens_user_purpose_idx on discotq.email_tokens (user_id, purpose, created_at desc);

-- -----------------------------------------------------------------------------
-- login_attempts: ログイン試行の記録（ブルートフォース対策のレート制限に使う）
-- -----------------------------------------------------------------------------
create table if not exists discotq.login_attempts (
  id          bigint generated always as identity primary key,
  email_lower text not null,
  ip_hash     text,
  succeeded   boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists login_attempts_email_idx on discotq.login_attempts (email_lower, created_at desc);
create index if not exists login_attempts_ip_idx on discotq.login_attempts (ip_hash, created_at desc);

-- -----------------------------------------------------------------------------
-- admins: 運営管理者（ここに user_id がある人だけ /admin を利用できる）
-- -----------------------------------------------------------------------------
create table if not exists discotq.admins (
  user_id    uuid primary key references discotq.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  note       text
);

-- -----------------------------------------------------------------------------
-- videos
-- -----------------------------------------------------------------------------
create table if not exists discotq.videos (
  id               uuid primary key default gen_random_uuid(),
  source           text not null,
  uploader_user_id uuid references discotq.users (id) on delete set null,
  anonymous_id     uuid,
  uploader_ip_hash text,                        -- ソルト付き SHA-256。生 IP は保存しない
  title            text not null default '',
  description      text not null default '',
  storage_provider text not null default 'r2',
  bucket           text not null,               -- 原本を置くバケット（private）
  object_key       text not null,
  thumb_key        text,
  public_url       text,                        -- 承認済みのとき public バケット上の URL
  thumb_url        text,
  mime_type        text not null,
  size_bytes       bigint not null,
  duration_sec     numeric(8, 2),               -- クライアント申告値
  width            integer,
  height           integer,
  status           text not null default 'pending_upload',
  auto_approve     boolean not null default false, -- 運営投稿で complete 時に審査を省略して承認する
  rejection_reason text,
  approved_by      uuid references discotq.users (id) on delete set null,
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint videos_source_chk check (source in ('platform', 'user')),
  constraint videos_status_chk check (status in (
    'pending_upload', 'uploaded', 'in_review', 'approved',
    'rejected', 'unpublished', 'failed', 'deleted'
  )),
  constraint videos_mime_chk check (mime_type in ('video/mp4', 'video/webm', 'video/quicktime')),
  constraint videos_size_chk check (size_bytes > 0),
  constraint videos_duration_chk check (duration_sec is null or duration_sec >= 0),
  constraint videos_title_len check (char_length(title) <= 100),
  constraint videos_description_len check (char_length(description) <= 2000),
  -- ユーザー投稿は、ログインユーザーか匿名IDのどちらかで投稿者を辿れること
  constraint videos_user_owner_chk check (
    source <> 'user' or uploader_user_id is not null or anonymous_id is not null
  ),
  constraint videos_rejected_reason_chk check (
    status <> 'rejected' or rejection_reason is not null
  ),
  constraint videos_approved_url_chk check (
    status <> 'approved' or public_url is not null
  )
);
create unique index if not exists videos_object_key_uq on discotq.videos (bucket, object_key);
-- フィード（承認済みを新しい順 + カーソル）
create index if not exists videos_feed_idx on discotq.videos (approved_at desc, id desc) where status = 'approved';
-- 管理画面のステータス別一覧・審査キュー
create index if not exists videos_status_created_idx on discotq.videos (status, created_at);
-- 自分の投稿一覧 / レート制限
create index if not exists videos_uploader_user_idx on discotq.videos (uploader_user_id, created_at desc);
create index if not exists videos_anonymous_idx on discotq.videos (anonymous_id, created_at desc);
create index if not exists videos_ip_hash_idx on discotq.videos (uploader_ip_hash, created_at desc);

drop trigger if exists videos_set_updated_at on discotq.videos;
create trigger videos_set_updated_at
  before update on discotq.videos
  for each row execute function discotq.set_updated_at();

-- -----------------------------------------------------------------------------
-- video_reviews: 審査操作の履歴
-- -----------------------------------------------------------------------------
create table if not exists discotq.video_reviews (
  id          bigint generated always as identity primary key,
  video_id    uuid not null references discotq.videos (id) on delete cascade,
  reviewer_id uuid references discotq.users (id) on delete set null,
  action      text not null,
  reason      text,
  created_at  timestamptz not null default now(),
  constraint video_reviews_action_chk check (action in ('approve', 'reject', 'unpublish', 'auto_approve')),
  constraint video_reviews_reject_reason_chk check (action <> 'reject' or reason is not null)
);
create index if not exists video_reviews_video_idx on discotq.video_reviews (video_id, created_at);

-- -----------------------------------------------------------------------------
-- audit_logs: 監査ログ（審査操作・削除・紐づけなど）
-- actor_id は匿名IDも入るため text で持つ
-- -----------------------------------------------------------------------------
create table if not exists discotq.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    text,
  actor_type  text not null,
  action      text not null,
  target_type text not null,
  target_id   text,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  constraint audit_logs_actor_type_chk check (actor_type in ('user', 'anonymous', 'admin', 'system'))
);
create index if not exists audit_logs_target_idx on discotq.audit_logs (target_type, target_id, created_at desc);
create index if not exists audit_logs_created_idx on discotq.audit_logs (created_at desc);

-- -----------------------------------------------------------------------------
-- TODO(広告機能): 今回は作らない。構想メモ
--   * discotq.campaigns     : 広告主・予算・配信期間・対象動画(video_id)・単価
--   * discotq.view_sessions : 視聴ごとの記録（video_id, user_id/anonymous_id, 視聴秒数, 完了フラグ）
--                             不正視聴対策のため IP ハッシュ・UA も保持
--   * discotq.point_ledger  : ポイントの増減を追記専用で記録（残高は集計で求める）
--                             view_sessions / campaigns への参照を持ち、二重付与を一意制約で防ぐ
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 権限: RLS を有効化し、ポリシーは作らない（= anon/authenticated からは何も見えない）
-- -----------------------------------------------------------------------------
alter table discotq.users          enable row level security;
alter table discotq.sessions       enable row level security;
alter table discotq.email_tokens   enable row level security;
alter table discotq.login_attempts enable row level security;
alter table discotq.admins         enable row level security;
alter table discotq.videos         enable row level security;
alter table discotq.video_reviews  enable row level security;
alter table discotq.audit_logs     enable row level security;

revoke all on schema discotq from public;
revoke all on all tables in schema discotq from public;
revoke all on all sequences in schema discotq from public;
revoke all on all functions in schema discotq from public;

-- Supabase の API ロールが存在する環境では明示的に剥奪する（素の Postgres ではスキップ）
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on schema discotq from %I', r);
      execute format('revoke all on all tables in schema discotq from %I', r);
      execute format('revoke all on all sequences in schema discotq from %I', r);
      execute format('revoke all on all functions in schema discotq from %I', r);
      execute format('alter default privileges in schema discotq revoke all on tables from %I', r);
      execute format('alter default privileges in schema discotq revoke all on sequences from %I', r);
      execute format('alter default privileges in schema discotq revoke all on functions from %I', r);
    end if;
  end loop;
end;
$$;

commit;
