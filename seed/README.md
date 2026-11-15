# seed（初期表示用の動画）

運営が用意した動画を、審査を省略して公開済み（`source=platform` / `status=approved`）として登録します。手元から本番の DB と R2 に直接接続して実行します。

```
seed/
├── videos.json   # マニフェスト（コミットする）
├── files/        # 動画・サムネイルの実ファイル（git 管理外）
├── cli.py        # python -m seed のコマンド
├── operations.py # 作成・一覧・不整合検出・削除・差し替えの処理
├── manifest.py   # マニフェストの読み込み・検証
└── mp4.py        # MP4 / MOV のヘッダー解析（長さ・解像度・faststart）
```

## 準備

1. 動画（縦型 9:16 の `.mp4` / `.m4v` / `.mov`）と、任意でサムネイル（`.jpg`）を `seed/files/` に置く
2. `seed/videos.json` に 1 本ずつ書く（配列の先頭がフィードの一番上になります）

   ```json
   [
     {
       "slug": "welcome",
       "file": "welcome.mp4",
       "title": "DiscoTQ へようこそ",
       "description": "説明（任意）",
       "thumbnail": "welcome.jpg"
     }
   ]
   ```

   | 項目          | 必須 | 内容                                                                                   |
   | ------------- | ---- | -------------------------------------------------------------------------------------- |
   | `slug`        | ○    | 識別子（英小文字・数字・ハイフン）。動画 ID はここから決まるため、**登録後は変えない** |
   | `file`        | ○    | `seed/files/` 内の動画ファイル名                                                       |
   | `title`       |      | タイトル（100 文字以内）                                                               |
   | `description` |      | 説明（2000 文字以内）                                                                  |
   | `thumbnail`   |      | `seed/files/` 内の JPEG。省略するとサムネイルなし                                      |

3. 接続先をリポジトリ直下の `.env.local` に書く（Vercel と同じ値）

   ```
   DATABASE_URL=...
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET_PRIVATE=discotq-private
   R2_BUCKET_PUBLIC=discotq-public
   R2_PUBLIC_BASE_URL=https://pub-xxxx.r2.dev
   EMAIL_BACKEND=console
   ```

## コマンド（リポジトリ直下で実行）

```bash
.venv/bin/python -m seed apply --dry-run   # 何が登録されるか確認（変更なし）
.venv/bin/python -m seed apply             # 未登録の seed を登録して公開
.venv/bin/python -m seed list              # 登録状況（DB の状態・R2 上の有無・公開 URL）
.venv/bin/python -m seed verify            # DB と R2 の不整合を検出（あれば終了コード 1）
.venv/bin/python -m seed replace           # ファイル・タイトル・説明・サムネの変更を反映
.venv/bin/python -m seed remove welcome    # 指定した seed を R2 と DB から削除
.venv/bin/python -m seed remove            # すべての seed を削除（確認あり。--yes で省略）
```

`apply` / `replace` / `remove` は slug を並べると対象を絞れます。いずれも `--dry-run` で変更せずに予定だけ表示します。

## 仕様

- **冪等**: 動画 ID は slug から UUID v5 で決まります。`apply` は登録済みの slug をスキップするので、何度実行しても重複しません
- **登録内容**: 通常の投稿と同じく、R2 の private（`videos/{id}/original.mp4`, `thumb.jpg`）に置いて public にコピーし、`discotq.videos` に参照先（`object_key` / `public_url` など）を保存します。`video_reviews` に `auto_approve`、`audit_logs` に `actor_type=system` / `action=seed.*` を記録します
- **事前チェック**: 形式、サイズ（100MB）、長さ（180 秒）、faststart、サムネイルが JPEG か。長さ・解像度はファイルのヘッダーから読み取ります（スマホの縦撮りの回転も考慮）
- **faststart でない MP4** は登録しません。表示されるコマンドで変換してください

  ```bash
  ffmpeg -i input.mp4 -c copy -movflags +faststart output.mp4
  ```

- **replace**: 動画の変更は R2 上の ETag（MD5）との比較で判定し、変わったものだけ再アップロードします。公開 URL は同じままなので、カスタムドメインの CDN キャッシュ（最大 1 時間）が残ることがあります
- **remove**: `source=user`（ユーザー投稿）の動画は削除しません。マニフェストから消した seed も、slug 指定なしの `remove` で削除できます
- `/admin` で非公開化・却下した seed も、`replace` はステータスを変えずにファイル等だけ更新します
