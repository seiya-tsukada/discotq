-- =============================================================================
-- 任意: API 専用の DB ロールを作る（他サービスと同じ DB を共有するため推奨）
--
-- init.sql の後に、Supabase の SQL Editor（postgres ロール）で実行する。
-- パスワードは実行前に必ず書き換えること。作成後の DATABASE_URL は
--   postgresql://discotq_app.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
-- （Supabase の pooler ではユーザー名に .<project-ref> を付ける）
--
-- このロールは discotq スキーマ以外にアクセスできない。
-- 全テーブルで RLS が有効なため、このロール専用の「全行許可」ポリシーを付ける
-- （anon / authenticated には引き続きポリシーも権限も無い）。
-- =============================================================================

begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'discotq_app') then
    create role discotq_app login password 'CHANGE_ME_TO_A_LONG_RANDOM_PASSWORD';
  end if;
end;
$$;

grant usage on schema discotq to discotq_app;
grant select, insert, update, delete on all tables in schema discotq to discotq_app;
grant usage, select on all sequences in schema discotq to discotq_app;
grant execute on all functions in schema discotq to discotq_app;
alter default privileges in schema discotq grant select, insert, update, delete on tables to discotq_app;
alter default privileges in schema discotq grant usage, select on sequences to discotq_app;

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'sessions', 'email_tokens', 'login_attempts',
    'admins', 'videos', 'video_reviews', 'audit_logs'
  ] loop
    execute format('drop policy if exists discotq_app_all on discotq.%I', t);
    execute format(
      'create policy discotq_app_all on discotq.%I for all to discotq_app using (true) with check (true)', t
    );
  end loop;
end;
$$;

commit;
