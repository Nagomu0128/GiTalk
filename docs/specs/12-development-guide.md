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

1. Firebase Console で Authentication を有効化（Google / メール・パスワード）
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
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
GCP_PROJECT_ID=gjh-hack
GEMINI_MODEL=gemini-1.5-flash
```

> **注意:** `firebase-service-account.json` は `.gitignore` に追加し、リポジトリにコミットしないこと。

### 3. Gemini API（Vertex AI）

ローカル開発では `gcloud` の Application Default Credentials (ADC) を使用:

```bash
gcloud auth application-default login
gcloud config set project gjh-hack
```

これにより `GOOGLE_APPLICATION_CREDENTIALS` なしでも Vertex AI にアクセスできる。

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

```
backend/src/
├── index.ts                 # Hono アプリのエントリーポイント
├── db/
│   ├── schema.ts            # Drizzle スキーマ定義
│   ├── client.ts            # DB 接続設定
│   └── migrations/          # マイグレーションファイル
├── routes/
│   ├── conversations.ts     # /conversations エンドポイント
│   ├── branches.ts          # /conversations/:id/branches エンドポイント
│   ├── nodes.ts             # /conversations/:id/nodes エンドポイント
│   ├── chat.ts              # /conversations/:id/chat エンドポイント
│   ├── git-operations.ts    # /conversations/:id/merge, reset, diff, cherry-pick
│   └── repositories.ts     # /repositories エンドポイント
├── services/
│   ├── conversation.service.ts
│   ├── branch.service.ts
│   ├── node.service.ts
│   ├── chat.service.ts
│   ├── git-operations.service.ts
│   └── repository.service.ts
├── domain/
│   ├── context-builder.ts   # コンテキスト構築ロジック
│   ├── lca.ts               # LCA アルゴリズム
│   └── tree.ts              # ツリー操作ユーティリティ
├── infra/
│   ├── gemini.ts            # Vertex AI / Gemini API クライアント
│   └── firebase-auth.ts     # Firebase Admin SDK 認証
├── middleware/
│   ├── auth.ts              # 認証ミドルウェア
│   ├── error-handler.ts     # エラーハンドリング
│   └── validator.ts         # Zod バリデーション
└── types/
    └── index.ts             # 共通型定義
```

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
| GCP_PROJECT_ID | Yes | GCP プロジェクトID | `gjh-hack` |
| GEMINI_MODEL | No | デフォルトモデル | `gemini-1.5-flash` |
| PORT | No | サーバーポート | `8080` |

### Frontend (.env.local)

| 変数名 | 必須 | 説明 | 例 |
|--------|------|------|-----|
| NEXT_PUBLIC_FIREBASE_API_KEY | Yes | Firebase API キー | `AIza...` |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | Yes | Firebase Auth ドメイン | `gitalk-01100128.firebaseapp.com` |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | Yes | Firebase プロジェクトID | `gitalk-01100128` |
| BACKEND_URL | Yes | バックエンド API URL | `http://localhost:8080` |
