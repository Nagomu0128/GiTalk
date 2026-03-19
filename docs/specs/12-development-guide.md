# 12 - ローカル開発ガイド

## 概要

GiTalk をローカル環境で開発するためのセットアップ手順とガイドライン。

## 前提条件

- Node.js 20+
- pnpm 10+
- Docker（PostgreSQL 用）
- GCP CLI (`gcloud`)（Vertex AI 認証用）
- Firebase CLI（App Hosting デプロイ用）

## ローカル環境セットアップ

### 1. PostgreSQL（Docker）

```bash
docker run --name gitalk-postgres \
  -e POSTGRES_USER=gitalk \
  -e POSTGRES_PASSWORD=gitalk \
  -e POSTGRES_DB=gitalk \
  -p 5432:5432 \
  -d postgres:15
```

接続文字列: `postgresql://gitalk:gitalk@localhost:5432/gitalk`

### 2. Firebase Authentication

**Firebase Emulator は使用しない。** 開発環境でも実際の Firebase プロジェクト（`gitalk-01100128`）に接続する。

1. Firebase Console で Authentication を有効化（Google プロバイダのみ）
2. フロントエンドの `.env.local` に Firebase クライアント設定を記載:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=gitalk-01100128
BACKEND_URL=http://localhost:8080
```

3. バックエンド用の Firebase サービスアカウントキーを取得:
   - Firebase Console → プロジェクト設定 → サービスアカウント → 新しい秘密鍵を生成
   - `backend/.env` に配置:

```env
DATABASE_URL=postgresql://gitalk:gitalk@localhost:5432/gitalk
FIREBASE_PROJECT_ID=gitalk-01100128
GCP_PROJECT_ID=gitalk-01100128
GEMINI_API_KEY=（Google AI Studio で取得した API キー）
GEMINI_MODEL=gemini-2.5-flash
```

> **注意:** `.env` は `.gitignore` に追加済み。`GEMINI_API_KEY` は [Google AI Studio](https://aistudio.google.com/apikey) で取得。

### 3. Gemini API（Google AI SDK）

ローカル開発では `.env` に `GEMINI_API_KEY` を設定するだけで動作する。`dotenv/config` が `index.ts` の先頭で読み込まれる。

### 4. データベースマイグレーション

マイグレーションツール: **Drizzle Kit** を使用（Drizzle ORM と統合）。

```bash
cd backend
pnpm drizzle-kit push   # スキーマを DB に適用（開発用）
pnpm drizzle-kit migrate # マイグレーションファイルを実行（本番用）
```

### 5. 開発サーバー起動

```bash
# バックエンド
cd backend
pnpm install
pnpm dev          # http://localhost:8080

# フロントエンド（別ターミナル）
cd frontend
pnpm install
pnpm dev          # http://localhost:3000
```

## ORM / クエリビルダ

**Drizzle ORM** を使用する。

選定理由:
- TypeScript ファーストで型安全
- SQL に近い記法で学習コストが低い
- Drizzle Kit によるマイグレーション管理が統合されている
- Hono との相性が良い（軽量）

```typescript
// スキーマ定義例（backend/src/db/schema.ts）
import { pgTable, uuid, varchar, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core';

export const visibilityType = pgEnum('visibility_type', ['private', 'public']);
export const nodeType = pgEnum('node_type', ['message', 'summary', 'system']);

export const users = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseUid: varchar('firebase_uid', { length: 128 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 2048 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ... 他のテーブルも同様に定義
```

## プロジェクト構成（バックエンド）

> このディレクトリ構成は `.claude/skills/coding-rules/SKILL.md` と完全に一致する。

```
backend/src/
├── index.ts                          # Hono アプリのエントリーポイント
├── middleware/                       # Hono ミドルウェア
│   ├── auth.ts                      # Firebase 認証、getAuthUser(c)
│   └── error-handler.ts            # Result → HTTP レスポンス変換
├── routes/                          # API ルート + ハンドラ
│   ├── conversations.route.ts      # OpenAPI スキーマ定義（Zod）
│   ├── conversations.ts            # /v1/conversations ハンドラ
│   ├── branches.route.ts
│   ├── branches.ts                 # /v1/conversations/:id/branches ハンドラ
│   ├── nodes.route.ts
│   ├── nodes.ts                    # /v1/conversations/:id/nodes ハンドラ
│   ├── chat.route.ts
│   ├── chat.ts                     # /v1/conversations/:id/chat ハンドラ（SSE）
│   ├── git-operations.route.ts
│   ├── git-operations.ts           # /v1/conversations/:id/merge, reset, diff
│   ├── repositories.route.ts
│   └── repositories.ts            # /v1/repositories ハンドラ
├── service/                         # アプリケーションサービス層
│   ├── conversation.service.ts
│   ├── branch.service.ts
│   ├── node.service.ts
│   ├── chat.service.ts
│   ├── git-operations.service.ts
│   └── repository.service.ts
├── domain/                          # ドメイン層（ビジネスロジック）
│   ├── context-builder.ts          # コンテキスト構築ロジック
│   ├── lca.ts                      # LCA（最近共通祖先）アルゴリズム
│   └── tree.ts                     # ツリー操作ユーティリティ
├── infra/                           # インフラ層（外部サービス連携）
│   ├── gemini.ts                   # Vertex AI / Gemini API クライアント
│   └── firebase-auth.ts           # Firebase Admin SDK
├── db/                              # データベース
│   ├── schema.ts                   # Drizzle ORM スキーマ定義
│   ├── client.ts                   # DB 接続設定
│   └── migrations/                 # マイグレーションファイル
├── shared/                          # 共有ユーティリティ
│   ├── error.ts                    # errorBuilder（neverthrow 用）
│   ├── logger.ts                   # appLogger
│   ├── rate-limiter.ts             # レート制限（MVP: インメモリ、将来: Upstash Redis）
│   └── types.ts                    # 共通型定義
└── test/
    └── unit/                       # ユニットテスト
```

### レイヤー間の依存関係

```
routes/ → service/ → domain/
                  → infra/

middleware/ → shared/
routes/    → shared/
service/   → shared/
infra/     → shared/

domain/ は他のレイヤーに依存しない
```

## 状態管理（フロントエンド）

**Zustand** を使用する。

選定理由:
- React Flow が内部で Zustand を使用しており相性が良い
- Provider ネストが不要（Context の課題を解決）
- 必要な部分だけ subscribe でき再レンダリングが最小限
- 軽量（1KB）

```
frontend/stores/
├── conversation-store.ts  # 会話・ブランチ・ノード状態
├── chat-store.ts          # チャットメッセージ・ストリーミング状態
├── tree-store.ts          # React Flow ノード・エッジ・選択状態
└── auth-store.ts          # 認証状態（AuthProvider の補助）
```

## タブ間同期

**BroadcastChannel API** を使用して、同一ユーザーの複数タブ間でデータを同期する。

```typescript
// shared/broadcast.ts
const channel = new BroadcastChannel("gitalk-sync");

// ノード作成後に他タブに通知
channel.postMessage({ type: "NODE_CREATED", conversationId, nodeId });

// 他タブからの通知を受信してストアを更新
channel.onmessage = (e) => {
  match(e.data.type)
    .with("NODE_CREATED", () => { /* ノードを再取得 */ })
    .with("BRANCH_SWITCHED", () => { /* ブランチ状態を更新 */ })
    .with("CONVERSATION_DELETED", () => { /* 一覧から削除 */ })
    .exhaustive();
};
```

追加のインフラコストはゼロ（ブラウザ API のみ）。

## プロジェクト構成（フロントエンド）

```
frontend/app/
├── layout.tsx               # ルートレイアウト（AuthProvider）
├── page.tsx                 # ランディングページ (/)
├── login/
│   └── page.tsx             # ログイン画面
├── dashboard/
│   ├── layout.tsx           # ダッシュボードレイアウト（サイドバー付き）
│   ├── page.tsx             # ダッシュボード (/)
│   ├── conversations/
│   │   └── page.tsx         # 会話一覧
│   └── repositories/
│       └── page.tsx         # リポジトリ一覧
├── conversation/
│   └── [id]/
│       └── page.tsx         # 会話画面（メイン）
└── repository/
    └── [id]/
        └── page.tsx         # リポジトリ詳細

frontend/stores/
├── conversation-store.ts  # 会話・ブランチ・ノード状態
├── chat-store.ts          # チャットメッセージ・ストリーミング状態
├── tree-store.ts          # React Flow ノード・エッジ・選択状態
└── auth-store.ts          # 認証状態

frontend/components/
├── providers/
│   └── auth-provider.tsx    # Firebase Auth Context
├── layout/
│   ├── global-header.tsx
│   └── sidebar.tsx
├── tree/
│   ├── tree-view.tsx        # React Flow ベースのツリー表示
│   ├── tree-node.tsx        # カスタムノードコンポーネント
│   ├── summary-node.tsx     # 要約ノード
│   ├── mini-tree-preview.tsx
│   └── elk-layout.ts       # ELK.js レイアウト計算
├── chat/
│   ├── chat-view.tsx        # メッセージ一覧
│   ├── message-bubble.tsx   # メッセージ表示
│   └── message-input.tsx    # 入力フォーム
├── branch/
│   ├── branch-selector.tsx  # ブランチ切替ドロップダウン
│   └── branch-context-menu.tsx
├── dialogs/
│   ├── merge-dialog.tsx
│   ├── push-dialog.tsx
│   └── diff-view.tsx
├── cards/
│   ├── conversation-card.tsx
│   └── repository-card.tsx
└── ui/
    └── command-palette.tsx
```

## 環境変数一覧

### Backend (.env)

| 変数名 | 必須 | 説明 | 例 |
|--------|------|------|-----|
| DATABASE_URL | Yes | PostgreSQL 接続文字列 | `postgresql://gitalk:gitalk@localhost:5432/gitalk` |
| FIREBASE_PROJECT_ID | Yes | Firebase プロジェクトID | `gitalk-01100128` |
| GCP_PROJECT_ID | Yes | GCP プロジェクトID | `gitalk-01100128` |
| GEMINI_API_KEY | Yes | Google AI SDK API キー | `AIza...` |
| GEMINI_MODEL | No | デフォルトモデル | `gemini-2.5-flash` |
| PORT | No | サーバーポート | `8080` |

### Frontend (.env.local)

| 変数名 | 必須 | 説明 | 例 |
|--------|------|------|-----|
| NEXT_PUBLIC_FIREBASE_API_KEY | Yes | Firebase API キー | `AIza...` |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | Yes | Firebase Auth ドメイン | `gitalk-01100128.firebaseapp.com` |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | Yes | Firebase プロジェクトID | `gitalk-01100128` |
| BACKEND_URL | Yes | バックエンド API URL | `http://localhost:8080` |
