# 001 - Session 1: バックエンド基盤

## 日時
2026-03-18

## 対象タスク
- T0-1: DB基盤（Drizzle ORM + Drizzle Kit + DB接続）
- T0-3: Hono ミドルウェア基盤（CORS, エラーハンドラー）
- T0-4: 共有ユーティリティ（errorBuilder, appLogger, rate-limiter）

## 実施内容

### パッケージ追加
- `drizzle-orm`, `postgres`: DB接続 + ORM
- `neverthrow`: Result型によるエラーハンドリング
- `ts-pattern`: パターンマッチング
- `zod`: バリデーション
- `drizzle-kit` (dev): マイグレーション管理

### ディレクトリ構成
SKILL.md に従い以下を作成:
```
src/
├── middleware/error-handler.ts
├── db/schema.ts, client.ts
├── shared/error.ts, logger.ts, rate-limiter.ts, types.ts
└── index.ts（更新）
```

### 作成ファイル

| ファイル | 内容 |
|---------|------|
| `shared/error.ts` | errorBuilder ユーティリティ。SKILL.md のパターンに準拠 |
| `shared/logger.ts` | appLogger。JSON 構造化ログ出力 |
| `shared/rate-limiter.ts` | インメモリレート制限。抽象化レイヤー付き |
| `shared/types.ts` | 共通型（PaginationParams, ApiErrorResponse 等） |
| `db/schema.ts` | 全テーブルスキーマ（User, Repository, Conversation, Branch, Node, RepositoryBranch, RepositoryNode） |
| `db/client.ts` | Drizzle + postgres.js 接続設定 |
| `drizzle.config.ts` | Drizzle Kit 設定 |
| `middleware/error-handler.ts` | グローバルエラーハンドラー |
| `index.ts` | CORS + エラーハンドラー + ヘルスチェック |

### eslint 設定変更
- `no-redeclare` を無効化（SKILL.md の `export const FooError` + `export type FooError` パターンを許可）

## 確認結果
- `tsc --noEmit`: パス
- `pnpm lint`: パス
- DB接続はローカル PostgreSQL が必要なため未確認（Session 2 以降で確認）

## 次のステップ
Session 2: 認証基盤（T1-1 + T1-2）
