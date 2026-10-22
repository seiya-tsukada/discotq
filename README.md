# DiscoTQ

新しい発見があるショート広告プラットフォーム。厳選ブランドのプロモーション視聴・体験リワード、公式LPチェック、広告枠出店機能を備えたフロントエンドアプリです。

## 画面

| パス | 内容 |
| --- | --- |
| `/` | 一般ユーザー向けショート広告フィード |
| `/creator` | 広告配信者向け 入稿・管理画面 |
| `/admin` | プラットフォーム運営者向け 広告審査画面 |

## 開発

前提: Node.js / [Bun](https://bun.sh)

```bash
bun install
bun run dev      # http://localhost:3000
bun run lint     # 型チェック
bun run build
```

## ディレクトリ構成

```
src/
├── components/   # UI コンポーネント
├── constants/    # 定数（ストレージキー、タイミング、リワード設定など）
├── context/      # アプリ全体の状態管理 (AppContext)
├── data/         # モックデータ
└── types/        # 型定義
```
