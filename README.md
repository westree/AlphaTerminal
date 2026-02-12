# 決算短信AI速報システム 📈

TDnetの決算短信をAIが自動分析し、増収増益銘柄を瞬時にキャッチするサーバーレスシステム。

## プロジェクト構造

```
TDNet/
├── wrangler.toml          # Cloudflare Workers 設定
├── package.json           # 依存関係
├── tsconfig.json          # TypeScript 設定
├── schema.sql             # D1 データベーススキーマ
├── src/
│   └── index.ts           # Worker ロジック（API + Cron）
└── public/
    └── index.html         # フロントエンド（Vue.js 3 + Tailwind CSS）
```

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| Backend | Cloudflare Workers + Hono |
| Database | Cloudflare D1 (SQLite) |
| Frontend | Vue.js 3 + Tailwind CSS (CDN) |
| AI分析 | Google Gemini 1.5 Flash (マルチモーダル) |
| スクレイピング | cheerio |

## セットアップ & デプロイ手順

### 1. 依存関係インストール

```bash
npm install
```

### 2. D1 データベース作成

```bash
npx wrangler d1 create tdnet-reports
```

> 出力される `database_id` を `wrangler.toml` の `<YOUR_D1_DATABASE_ID>` に置き換えてください。

### 3. スキーマ適用

```bash
# ローカル用
npx wrangler d1 execute tdnet-reports --file=./schema.sql --local

# 本番用
npx wrangler d1 execute tdnet-reports --file=./schema.sql --remote
```

### 4. Gemini API キー設定

```bash
npx wrangler secret put GOOGLE_API_KEY
# プロンプトが表示されたら API キーを入力
```

API キーは [Google AI Studio](https://aistudio.google.com/apikey) から取得してください。

### 5. デプロイ

```bash
npx wrangler deploy
```

### 6. 動作確認

```bash
# ローカル開発サーバー
npx wrangler dev

# ブラウザで http://localhost:8787 にアクセス
# API: http://localhost:8787/api/reports
# ヘルスチェック: http://localhost:8787/api/health
```

## 機能概要

- **10分ごとの自動スクレイピング**: Cron Trigger で TDnet を定期監視
- **AI決算分析**: Gemini 1.5 Flash が PDF を直接読み取り、売上・利益の増減率を抽出
- **増収増益ハイライト**: 増収増益銘柄を緑の枠線とバッジで強調表示
- **ダークモードUI**: グラスモーフィズムを活用したモダンなダッシュボード

## 注意事項

- TDnet のスクレイピングは利用規約を確認の上、自己責任でご利用ください
- Cloudflare Workers の無料プランは 1日 10万リクエスト、Cron は 5個まで
- D1 の無料プランは 5GB / 5M rows まで
- Gemini API の無料枠は 1日 1500リクエストまで（2024年12月時点）
