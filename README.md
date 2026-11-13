# DiscoTQ

新しい発見があるショート動画プラットフォーム。縦型ショート動画の視聴リワード、ログイン不要の動画投稿、運営による審査・公開管理を備えています。

## 画面

| パス              | 内容                                                                  |
| ----------------- | --------------------------------------------------------------------- |
| `/`               | 視聴フィード（承認済み動画を `/api/videos/feed` から取得）            |
| `/user`           | 動画投稿（D&D・進捗・サムネ自動生成）、自分の投稿と審査ステータス     |
| `/admin`          | 運営管理（審査キュー・プレビュー・承認/却下・非公開化・運営動画投稿） |
| `/verify-email`   | メールアドレス確認（メール内リンクの遷移先）                          |
| `/reset-password` | パスワード再設定（メール内リンクの遷移先）                            |

## 構成

```
api/index.py                 # Vercel の Python エントリ（backend の app を公開するだけ）
backend/app/
├── main.py                  # FastAPI 本体（全ルートは /api 配下）
├── config.py                # 環境変数（pydantic-settings。必須値が無ければ起動時エラー）
├── db.py                    # Supabase Postgres 接続（psycopg、transaction pooler）
├── auth.py                  # セッション Cookie / X-Anonymous-Id / 管理者判定 / CSRF
├── storage/                 # ストレージ抽象（base.py）と R2 実装（r2.py）
├── services/videos.py       # アップロード・審査の業務ロジック
├── repositories/            # SQL
├── routers/                 # health / public / uploads / me / admin / auth
└── schemas/                 # Pydantic モデル
backend/tests/               # pytest（実 Postgres + moto）
scripts/                     # create_admin.py / setup_r2_cors.py
supabase/migration/          # init.sql（スキーマ）, optional_app_role.sql（API 専用ロール）
supabase/maintenance/        # 運用 SQL（01〜06）
src/                         # フロントエンド（Vite + React + TypeScript）
├── pages/user, pages/admin, pages/auth
├── components/              # フィード・アップロード・認証フォームなど
├── context/                 # AuthContext（サーバーのセッション）/ AppContext（フィード・リワード）
└── lib/api.ts               # API クライアント（CSRF ヘッダー・匿名ID・署名付き PUT）
vercel.json                  # /api/* → FastAPI、それ以外 → SPA の index.html
```

### アップロードの流れ

1. フロント → `POST /api/uploads/intent`（ファイル名・MIME・サイズ・尺・サムネのサイズ）
2. API がバリデーション・レート制限を行い、`videos` に `pending_upload` で行を作成。private バケットへの署名付き PUT URL（15 分、Content-Type と Content-Length を署名に含む）を返す
3. ブラウザから R2 に直接 PUT（進捗表示）。サムネイルは video → canvas で生成した JPEG を同様に PUT
4. フロント → `POST /api/uploads/{id}/complete`
5. API が `head_object` で実サイズ・Content-Type を検証。不一致なら削除して `failed`、一致すれば `in_review`
6. 運営が承認すると private → public に `copy_object` し、`public_url` を保存。却下・非公開化・削除では public から削除（private の原本は 30 日後に 04_purge で削除）

オブジェクトキー: `videos/{video_id}/original.{mp4|webm|mov}` / `videos/{video_id}/thumb.jpg`

### 認証

- Supabase Auth は使わず、`discotq` スキーマ内で独自に実装（他サービスと DB を共有するため）
- メール + パスワード（argon2id）。セッションは httpOnly Cookie（DB には SHA-256 のみ保存、30 日・スライディング）
- メール確認・パスワード再設定は Resend で送信。再設定で全セッションを失効
- 未ログインでも投稿可。フロントが生成した UUID を `X-Anonymous-Id` で送り、自分の投稿の一覧・削除に使う。ログイン（メール確認済み）後に `POST /api/me/claim` でアカウントへ紐づけ
- 更新系 API は `X-Requested-With: discotq` ヘッダー必須（CSRF 対策）
- 管理者: `discotq.admins` に登録された、メール確認済みのユーザー
- レート制限: 匿名・未確認ユーザーは anonymous_id 単位と IP 単位（ソルト付きハッシュ）で 1 日 `ANON_DAILY_UPLOAD_LIMIT` 件、確認済みユーザーは 1 日 `USER_DAILY_UPLOAD_LIMIT` 件。専用テーブルは持たず `videos` の件数で判定（intent 時点で数えるため連打も抑止）

## ローカル開発

前提: [Bun](https://bun.sh)、Python 3.12（[uv](https://docs.astral.sh/uv/) 推奨）、Docker（テスト用 Postgres）

```bash
bun install
uv venv -p 3.12 .venv && uv pip install -p .venv/bin/python -r requirements-dev.txt
cp .env.example .env.local   # 値を埋める（ローカルは EMAIL_BACKEND=console / SESSION_COOKIE_SECURE=false）
```

2 つのターミナルで同時に起動します。Vite が `/api` を uvicorn に転送するので、本番と同じ同一オリジン構成になります。

```bash
.venv/bin/uvicorn backend.app.main:app --reload --port 8000
```

```bash
bun dev   # http://localhost:3000
```

8000 番が使用中の場合は uvicorn を別ポートで起動し、`API_PROXY_TARGET=http://127.0.0.1:8010 bun dev` のように指定します。

`EMAIL_BACKEND=console` のときは、確認メール・再設定メールの本文（リンク）が uvicorn のログに出力されます。

### テスト・静的チェック

```bash
docker run -d --rm --name discotq-pg-test -e POSTGRES_PASSWORD=postgres -p 54329:5432 postgres:17-alpine
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54329/postgres .venv/bin/pytest backend
.venv/bin/mypy --config-file backend/mypy.ini backend api scripts
bun run lint   # tsc + ESLint
bun run test   # Vitest
```

`TEST_DATABASE_URL` が未設定の場合、DB を使うテストはスキップされます。テストはセッション開始時に `discotq` スキーマを作り直すので、本番やステージングの DB を指定しないでください。

## セットアップ

### 1. Cloudflare R2

1. **バケットを 2 つ作成**（R2 > Create bucket）
   - `discotq-private`: 投稿直後・審査中の原本。公開アクセスは無効のまま
   - `discotq-public`: 承認済み動画
2. **public バケットにカスタムドメインを設定**（バケット > Settings > Custom Domains、例: `media.example.com`）。`r2.dev` の公開 URL は本番では使わない。このドメインを `R2_PUBLIC_BASE_URL` に設定
3. **API トークンを作成**（R2 > Manage R2 API Tokens > Create API Token）
   - 権限: Object Read & Write、対象: 上記 2 バケットのみ
   - 発行された Access Key ID / Secret Access Key を `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` に、アカウント ID を `R2_ACCOUNT_ID` に設定
4. **CORS を投入**（ブラウザからの直接 PUT と再生に必要）

   ```bash
   .venv/bin/python scripts/setup_r2_cors.py \
     --origin https://discotq.example.com --origin http://localhost:3000 \
     --vercel-preview-project discotq --vercel-team <team-slug>
   ```

   `--dry-run` で投入内容だけ確認できます。

### 2. Supabase（Postgres）

1. SQL Editor で `supabase/migration/init.sql` を実行（何度実行しても壊れません）
2. （推奨）`supabase/migration/optional_app_role.sql` のパスワードを書き換えて実行し、`discotq` スキーマにしか触れない API 専用ロール `discotq_app` を作る
3. `DATABASE_URL` には **transaction pooler（ポート 6543）** の接続文字列を使う（Project Settings > Database > Connection string > Transaction pooler）。専用ロールの場合、ユーザー名は `discotq_app.<project-ref>`
4. 最初の管理者を作成

   ```bash
   DATABASE_URL=... .venv/bin/python scripts/create_admin.py create admin@example.com --name 運営
   DATABASE_URL=... .venv/bin/python scripts/create_admin.py list
   ```

   既存ユーザーを管理者にする場合は `grant`、外す場合は `revoke`、パスワードを再設定する場合は `reset-password` を使います。

全テーブルで RLS を有効にし、`anon` / `authenticated` には権限を付与していません。`discotq` スキーマを PostgREST（Data API）の公開スキーマに追加しないでください。

### 3. Resend（メール送信）

1. 送信元ドメインを Resend で認証（DNS に SPF / DKIM を追加）
2. API キーを `RESEND_API_KEY` に、送信元を `EMAIL_FROM` に設定（例: `DiscoTQ <no-reply@discotq.example.com>`）

### 4. Vercel

フロント（Vite）と FastAPI を同一プロジェクトでデプロイします（`vercel.json` 参照）。Project Settings > Environment Variables に以下を設定します。

| 変数                                                          | 例・説明                                        |
| ------------------------------------------------------------- | ----------------------------------------------- |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 の API トークン                              |
| `R2_BUCKET_PRIVATE` / `R2_BUCKET_PUBLIC`                      | `discotq-private` / `discotq-public`            |
| `R2_PUBLIC_BASE_URL`                                          | `https://media.example.com`                     |
| `DATABASE_URL`                                                | transaction pooler（6543）                      |
| `MAX_UPLOAD_BYTES` / `MAX_VIDEO_DURATION_SEC`                 | `104857600` / `180`                             |
| `ANON_DAILY_UPLOAD_LIMIT`                                     | `5`                                             |
| `CORS_ALLOWED_ORIGINS`                                        | 同一ドメインなら空で可                          |
| `APP_BASE_URL`                                                | `https://discotq.example.com`（メール内リンク） |
| `IP_HASH_SALT`                                                | ランダムな長い文字列                            |
| `EMAIL_BACKEND` / `RESEND_API_KEY` / `EMAIL_FROM`             | `resend` / Resend の API キー / 送信元          |
| `VITE_API_BASE_URL`                                           | 同一ドメインなら空                              |

**`VITE_` で始まる変数はフロントの JS に埋め込まれ公開されます。秘密情報には絶対に `VITE_` を付けないでください。**

プレビュー環境では `APP_BASE_URL` をプレビュー URL に合わせるか、メールのリンク先が本番になることに注意してください。

## 死活監視

| エンドポイント          | 内容                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `GET /api/health`       | liveness。DB に接続しない。`{"status": "ok", "email": "<EMAIL_BACKEND>"}`                            |
| `GET /api/health/ready` | readiness。READ ONLY・タイムアウト 3 秒で `select 1` を実行し、通れば `200`、DB に届かなければ `503` |

必須の環境変数が欠けていると API は起動時に停止するため、`/api/health` も `500` になります。その場合は Vercel の Function ログに、不足している変数名が pydantic の `ValidationError` として出力されます。

## 動画ファイルの推奨形式（faststart）

ブラウザで MP4 をすぐ再生し始めるには、moov atom がファイル先頭にある（faststart）必要があります。R2 にはトランスコード機能がないため、運営動画は投稿前に確認してください。

```bash
# moov と mdat の順序を確認（moov が先なら faststart 済み）
ffprobe -v trace input.mp4 2>&1 | grep -E "type:'(moov|mdat)'" | head -2

# faststart を適用（再エンコードなし）
ffmpeg -i input.mp4 -c copy -movflags +faststart output.mp4
```

縦型（9:16、例: 1080×1920）、H.264 + AAC の MP4 が最も互換性が高い形式です。

## 運用 SQL（`supabase/maintenance/`）

| ファイル                       | 用途                                                         | 頻度 | 破壊的                |
| ------------------------------ | ------------------------------------------------------------ | ---- | --------------------- |
| `01_stale_pending_uploads.sql` | 24 時間以上 `pending_upload` の行を `failed` に＋R2 削除キー | 日次 | あり（rollback 雛形） |
| `02_review_queue_stats.sql`    | ステータス別件数・最古の審査待ち・平均審査時間               | 随時 | なし                  |
| `03_storage_usage.sql`         | バケット別の合計サイズ・件数（R2 無料枠の監視）              | 週次 | なし                  |
| `04_purge_candidates.sql`      | 却下・削除から 30 日経過した動画（R2 削除用）                | 週次 | あり（rollback 雛形） |
| `05_orphan_check.sql`          | `public_url` があるのに未承認などの不整合検出                | 日次 | なし                  |
| `06_anonymous_abuse_check.sql` | anonymous_id / IP あたりの投稿数上位                         | 日次 | なし                  |

更新系は `begin; ... rollback;` で書いてあるので、結果を確認してから `commit;` に書き換えて実行してください。

## 既知の制約・今後の課題

- 動画の尺はクライアントの申告値で判定しています（サーバーでのデコードは行わない）。Cloudflare Stream へ移行すると、サーバー側で尺の検証やトランスコードができます。`backend/app/storage/base.py` の `VideoStorage` を実装して `deps.get_storage` を差し替えれば移行できます
- いいね・コメント・視聴ポイントは端末内（localStorage）のみで保持しています。広告関連のテーブル（campaigns / view_sessions / point_ledger）は `init.sql` に構想を TODO として残しています
- 個別動画へのディープリンク（共有 URL）には未対応です

### TypeScript について

型チェックには TypeScript 7 (`@typescript/native` の `tsc`) を使います。typescript-eslint が TS 7 の API に未対応のため、`typescript` パッケージは TS 6 互換パッケージ (`@typescript/typescript6`) にエイリアスしています。
