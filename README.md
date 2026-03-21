# GiTalk — Git + Talk

AIチャットに Git / GitHub のコンセプトを融合し、会話の**分岐・管理・保存・共有**を構造的に行えるアプリケーション。

## 解決する課題

- **会話の埋没** — 長い会話から過去の議論を見つけ出すのが困難
- **単線的な会話** — 一つの話題から複数の方向に探索できない
- **会話資産の管理不在** — 過去の会話が時系列で並ぶだけで、構造的に管理・再利用できない

## 主な機能

### Git 的機能 — 会話の分岐と操作

- 会話をツリー構造（ノード）として管理
- 任意のノードからブランチを作成（遡及的分岐）
- branch / switch / merge / reset / diff を GUI で提供
- React Flow + ELK.js による会話ツリーの可視化

### GitHub 的機能 — 会話の保存と共有

- 会話ツリー全体を「リポジトリ」として保存
- 公開範囲の制御（private / public）
- 選択的 push（全ブランチ or 特定ブランチ）

### AI チャット

- Gemini API によるストリーミング応答（SSE）
- コンテキストモード（full / summary / minimal）で会話履歴の送信量を制御

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 16 / React 19 / TypeScript |
| UI | Tailwind CSS 4 / shadcn/ui / React Flow / ELK.js |
| 状態管理 | Zustand |
| バックエンド | Hono.js / TypeScript |
| DB | PostgreSQL 15 / Drizzle ORM |
| AI | Gemini API（@google/genai） |
| 認証 | Firebase Authentication |
| インフラ | GCP（Cloud Run / Cloud SQL / Firebase App Hosting） |
| IaC | Terraform |
| CI/CD | Cloud Build |

## アーキテクチャ

```
frontend/          Next.js (App Router)
├── app/           ページ・レイアウト
├── components/    UIコンポーネント
├── stores/        Zustand ストア
├── hooks/         カスタムフック
└── lib/           ユーティリティ

backend/           Hono.js REST API
├── middleware/    認証・エラーハンドリング・ログ
├── routes/        APIハンドラ（Zod バリデーション）
├── service/       ビジネスロジックの統合
├── domain/        ドメインロジック（外部依存なし）
├── infra/         DB クエリ・外部 API
├── db/            Drizzle スキーマ・マイグレーション
└── shared/        共有ユーティリティ
```

## セットアップ

### 前提条件

- Node.js 20+
- pnpm 10+
- Docker

### 1. PostgreSQL の起動

```bash
docker run --name gitalk-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=gitalk \
  -p 5432:5432 \
  -d postgres:15
```

### 2. バックエンド

```bash
cd backend
pnpm install

# .env を作成（以下を設定）
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gitalk
# FIREBASE_PROJECT_ID=<your-project-id>
# GCP_PROJECT_ID=<your-project-id>
# GEMINI_API_KEY=<your-api-key>
# GEMINI_MODEL=gemini-2.0-flash

# DB マイグレーション
pnpm db:push

# 開発サーバー起動
pnpm dev
```

### 3. フロントエンド

```bash
cd frontend
pnpm install

# .env.local を作成（以下を設定）
# NEXT_PUBLIC_FIREBASE_API_KEY=<your-api-key>
# NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<your-domain>
# NEXT_PUBLIC_FIREBASE_PROJECT_ID=<your-project-id>
# NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<your-bucket>
# NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>
# NEXT_PUBLIC_FIREBASE_APP_ID=<your-app-id>
# NEXT_PUBLIC_BACKEND_URL=http://localhost:8080

# 開発サーバー起動
pnpm dev
```

## 開発コマンド

### フロントエンド

| コマンド | 説明 |
|---------|------|
| `pnpm dev` | 開発サーバー起動 |
| `pnpm build` | プロダクションビルド |
| `pnpm lint` | ESLint 実行 |
| `pnpm fix` | Prettier でフォーマット |

### バックエンド

| コマンド | 説明 |
|---------|------|
| `pnpm dev` | 開発サーバー起動（ホットリロード） |
| `pnpm build` | TypeScript コンパイル |
| `pnpm test` | テスト実行 |
| `pnpm db:generate` | マイグレーションファイル生成 |
| `pnpm db:push` | スキーマを DB に反映 |
| `pnpm db:studio` | Drizzle Studio 起動 |

## デプロイ

```
GitHub Push (main)
├── Frontend: Firebase App Hosting（自動デプロイ）
└── Backend: Cloud Build
    ├── Lint
    ├── DB マイグレーション
    ├── Docker ビルド → Artifact Registry
    └── Cloud Run へデプロイ
```

## ドキュメント

詳細な仕様書は `docs/specs/` を参照:

- `00-overview.md` — プロジェクト概要
- `01-data-model.md` — データモデル
- `02-core-features.md` — Git 的機能仕様
- `03-repository.md` — GitHub 的機能仕様
- `04-ai-integration.md` — AI 統合
- `05-ui-ux.md` — UI/UX 設計
- `06-auth-and-access.md` — 認証・アクセス制御
- `07-api-design.md` — REST API 設計
- `08-infrastructure.md` — インフラ構成
