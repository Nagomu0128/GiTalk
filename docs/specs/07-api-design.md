# 07 - API 設計

## 概要

Hono.js で構築する REST API の設計。
フロントエンド（Next.js）から `/api/*` 経由でプロキシされる。

## 認証

全エンドポイント（一部 public を除く）で `Authorization: Bearer <firebase-id-token>` を必要とする。

## エンドポイント一覧

### 会話（Conversation）

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| POST | `/conversations` | 新規会話作成 | 必須 |
| GET | `/conversations` | 自分の会話一覧取得 | 必須 |
| GET | `/conversations/:id` | 会話詳細取得 | 必須 |
| PATCH | `/conversations/:id` | 会話情報更新（タイトル等） | 必須 |
| DELETE | `/conversations/:id` | 会話削除 | 必須 |

### ブランチ（Branch）

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| POST | `/conversations/:id/branches` | ブランチ作成 | 必須 |
| GET | `/conversations/:id/branches` | ブランチ一覧取得 | 必須 |
| PATCH | `/conversations/:id/branches/:branchId` | ブランチ更新（名前変更、head変更） | 必須 |
| DELETE | `/conversations/:id/branches/:branchId` | ブランチ削除 | 必須 |

### ノード（Node）

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/conversations/:id/nodes` | 全ノード取得（ツリー構築用） | 必須 |
| GET | `/conversations/:id/nodes/:nodeId` | ノード詳細取得 | 必須 |
| GET | `/conversations/:id/nodes/:nodeId/path` | ノードからルートまでのパス取得 | 必須 |

### チャット（AI連携）

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| POST | `/conversations/:id/chat` | メッセージ送信（SSEストリーミング） | 必須 |

**リクエスト:**
```json
{
  "branch_id": "uuid",
  "message": "ユーザーのメッセージ",
  "model": "gemini-1.5-pro",
  "context_mode": "full | summary | minimal"
}
```

**レスポンス:** SSE ストリーム
```
data: {"type": "chunk", "content": "AIの応答の一部"}
data: {"type": "chunk", "content": "続き..."}
data: {"type": "done", "node_id": "uuid", "token_count": 1234}
```

### Git的操作

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| POST | `/conversations/:id/merge` | ブランチのマージ | 必須 |
| POST | `/conversations/:id/reset` | ブランチのリセット | 必須 |
| POST | `/conversations/:id/cherry-pick` | ノードのcherry-pick | 必須 |
| GET | `/conversations/:id/diff` | ブランチ間の差分取得 | 必須 |

**Merge リクエスト:**
```json
{
  "source_branch_id": "uuid",
  "target_branch_id": "uuid",
  "summary_strategy": "concise | detailed | conclusion_only"
}
```

**Reset リクエスト:**
```json
{
  "branch_id": "uuid",
  "target_node_id": "uuid"
}
```

**Cherry-pick リクエスト:**
```json
{
  "source_node_id": "uuid",
  "target_branch_id": "uuid"
}
```

**Diff クエリ:**
```
GET /conversations/:id/diff?branch_a=uuid&branch_b=uuid
```

### リポジトリ（Repository）

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| POST | `/repositories` | リポジトリ作成 | 必須 |
| GET | `/repositories` | 自分のリポジトリ一覧 | 必須 |
| GET | `/repositories/:id` | リポジトリ詳細 | 条件付き |
| PATCH | `/repositories/:id` | リポジトリ更新 | 必須 |
| DELETE | `/repositories/:id` | リポジトリ削除 | 必須 |
| GET | `/repositories/:id/branches` | リポジトリのブランチ一覧 | 条件付き |
| GET | `/repositories/:id/nodes` | リポジトリの全ノード | 条件付き |

> 「条件付き」= public ならば認証不要、private/limited_access は認証+権限チェック

### Push

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| POST | `/repositories/:id/push` | 会話をリポジトリにpush | 必須 |

**リクエスト:**
```json
{
  "conversation_id": "uuid",
  "branch_ids": ["uuid", "uuid"]
}
```

`branch_ids` を省略した場合は全ブランチをpush。

### 公開リポジトリ

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/explore/repositories` | 公開リポジトリ一覧 | 不要 |

## エラーレスポンス

統一フォーマット:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Conversation not found"
  }
}
```

| HTTP Status | code | 用途 |
|-------------|------|------|
| 400 | BAD_REQUEST | リクエスト不正 |
| 401 | UNAUTHORIZED | 認証エラー |
| 403 | FORBIDDEN | 権限不足 |
| 404 | NOT_FOUND | リソース不存在 |
| 429 | RATE_LIMITED | レート制限 |
| 500 | INTERNAL_ERROR | サーバーエラー |
