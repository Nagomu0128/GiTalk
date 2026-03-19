# 07 - API 設計

## 概要

Hono.js で構築する REST API の設計。
すべてのエンドポイントは `/v1` プレフィックスを持つ。
フロントエンド（Next.js）から `/api/*` 経由でプロキシされる（Next.js 側で `/api/v1/*` → バックエンド `/v1/*` にリライト）。

## 共通仕様

### 認証

全エンドポイント（一部 public を除く）で `Authorization: Bearer <firebase-id-token>` を必要とする。

### ページネーション

一覧系エンドポイントはカーソルベースのページネーションを使用する。

**クエリパラメータ:**
- `cursor`: 前回レスポンスの `next_cursor` 値（初回は省略）。**cursor の指すアイテムは結果に含まず、その次から返す**（"start AFTER cursor"）
- `limit`: 取得件数（デフォルト: 20、最大: 100）
- `sort`: ソート順（エンドポイントごとに指定可能なフィールドが異なる。デフォルト: `updated_at desc`）

**レスポンス形式:**
```json
{
  "data": [...],
  "next_cursor": "uuid-of-last-item",
  "has_more": true
}
```

### 入力バリデーション

| フィールド | ルール |
|-----------|--------|
| title（会話/リポジトリ） | 1〜200文字。空文字不可 |
| description | 最大 2000 文字。空文字は NULL として扱う |
| branch name | 1〜100文字。英数字、ハイフン、アンダースコアのみ。`^[a-zA-Z0-9_-]+$` |
| message（チャット） | 1〜50,000文字。空文字不可 |
| model | `gemini-2.5-flash` または `gemini-2.5-pro` のいずれか |
| context_mode | `full`、`summary`、`minimal` のいずれか。デフォルト: `summary` |
| summary_strategy | `concise`、`detailed`、`conclusion_only` のいずれか。デフォルト: `detailed` |
| UUID パラメータ | UUID v4 形式 |

バリデーションエラー時は `400 BAD_REQUEST` を返す。

## エンドポイント一覧

### 会話（Conversation）

| Method | Path | 説明 | 認証 | MVP |
|--------|------|------|------|-----|
| POST | `/v1/conversations` | 新規会話作成 | 必須 | Yes |
| GET | `/v1/conversations` | 自分の会話一覧取得 | 必須 | Yes |
| GET | `/v1/conversations/:id` | 会話詳細取得 | 必須 | Yes |
| PATCH | `/v1/conversations/:id` | 会話情報更新（タイトル等） | 必須 | Yes |
| DELETE | `/v1/conversations/:id` | 会話削除（soft delete） | 必須 | Yes |
| GET | `/v1/conversations/deleted` | 削除済み会話一覧（30日以内） | 必須 | Yes |
| POST | `/v1/conversations/:id/restore` | 削除済み会話の復元 | 必須 | Yes |

**POST /v1/conversations レスポンス:**
会話作成時にデフォルトブランチ "main"（`is_default: true`）を自動作成し、`active_branch_id` にセットして返す。

```json
{
  "id": "uuid",
  "title": "新しい会話",
  "active_branch_id": "uuid",
  "branches": [
    { "id": "uuid", "name": "main", "is_default": true, "head_node_id": null }
  ],
  "created_at": "2026-03-18T00:00:00Z"
}
```

**DELETE /v1/conversations/:id:**
Soft delete。`deleted_at = NOW()` を設定する。物理削除はしない。30日後にバッチジョブで物理削除。

**GET /v1/conversations/deleted:**
削除済み会話一覧を取得（復元用）。`deleted_at IS NOT NULL AND deleted_at > NOW() - INTERVAL '30 days'`。

**POST /v1/conversations/:id/restore:**
削除済み会話を復元（`deleted_at = NULL` に戻す）。

### ブランチ（Branch）

| Method | Path | 説明 | 認証 | MVP |
|--------|------|------|------|-----|
| POST | `/v1/conversations/:id/branches` | ブランチ作成 | 必須 | Yes |
| GET | `/v1/conversations/:id/branches` | ブランチ一覧取得 | 必須 | Yes |
| PATCH | `/v1/conversations/:id/branches/:branchId` | ブランチ更新（名前変更） | 必須 | Yes |
| DELETE | `/v1/conversations/:id/branches/:branchId` | ブランチ削除 | 必須 | Yes |

**POST /conversations/:id/branches リクエスト:**
```json
{
  "name": "pricing-discussion",
  "base_node_id": "uuid"
}
```

**制約:**
- `name` は同一 Conversation 内で一意
- `base_node_id` は指定した Conversation に属するノードでなければならない
- デフォルトブランチ（`is_default: true`）は DELETE 不可（`403 FORBIDDEN`）

### ノード（Node）

| Method | Path | 説明 | 認証 | MVP |
|--------|------|------|------|-----|
| GET | `/v1/conversations/:id/nodes` | 全ノード取得（ツリー構築用） | 必須 | Yes |
| GET | `/v1/conversations/:id/nodes/:nodeId` | ノード詳細取得 | 必須 | Yes |
| GET | `/v1/conversations/:id/nodes/:nodeId/path` | ノードからルートまでのパス取得 | 必須 | Yes |

**GET /conversations/:id/nodes レスポンス:**
ページネーションなし。Conversation 内の全ノードを返す（React Flow でのツリー構築に全ノードが必要なため）。

```json
{
  "nodes": [
    {
      "id": "uuid",
      "parent_id": null,
      "branch_id": "uuid",
      "node_type": "message",
      "user_message": "...",
      "ai_response": "...",
      "model": "gemini-2.5-flash",
      "token_count": 500,
      "metadata": null,
      "created_by": "uuid",
      "created_at": "2026-03-18T00:00:00Z"
    }
  ]
}
```

### チャット（AI連携）

| Method | Path | 説明 | 認証 | MVP |
|--------|------|------|------|-----|
| POST | `/v1/conversations/:id/chat` | メッセージ送信（SSEストリーミング） | 必須 | Yes |

**リクエスト:**
```json
{
  "branch_id": "uuid",
  "message": "ユーザーのメッセージ",
  "model": "gemini-2.5-flash",
  "context_mode": "summary"
}
```

**デフォルト値:**
- `model`: `"gemini-2.5-flash"`
- `context_mode`: `"summary"`

**レスポンス:** SSE ストリーム（`Content-Type: text/event-stream`）
```
data: {"type":"chunk","content":"AIの応答の一部"}

data: {"type":"chunk","content":"続き...\n改行も含む"}

data: {"type":"done","node_id":"uuid","token_count":1234}

```

エラー時:
```
data: {"type":"error","code":"STREAM_INTERRUPTED","message":"ストリーミングが中断されました"}

```

DB保存失敗時:
```
data: {"type":"save_failed","message":"ノードの保存に失敗しました","user_message":"...","ai_response":"..."}

```

タイトル自動生成完了時（初回メッセージのみ、非同期で別途送信）:
```
data: {"type":"title_generated","title":"生成されたタイトル"}

```

### ブランチ切替

| Method | Path | 説明 | 認証 | MVP |
|--------|------|------|------|-----|
| POST | `/v1/conversations/:id/switch` | アクティブブランチを切り替え | 必須 | Yes |

**リクエスト:**
```json
{
  "branch_id": "uuid"
}
```

**レスポンス:**
```json
{
  "active_branch_id": "uuid",
  "branch": {
    "id": "uuid",
    "name": "pricing-discussion",
    "head_node_id": "uuid"
  }
}
```

> `Conversation.active_branch_id` を更新し、切替先ブランチの情報を返す。

### Git的操作

| Method | Path | 説明 | 認証 | MVP |
|--------|------|------|------|-----|
| POST | `/v1/conversations/:id/merge` | ブランチのマージ | 必須 | Yes |
| POST | `/v1/conversations/:id/reset` | ブランチのリセット | 必須 | Yes |
| POST | `/v1/conversations/:id/cherry-pick` | ノードのcherry-pick | 必須 | No |
| GET | `/v1/conversations/:id/diff` | ブランチ間の差分取得 | 必須 | Yes |

**Merge リクエスト:**
```json
{
  "source_branch_id": "uuid",
  "target_branch_id": "uuid",
  "summary_strategy": "detailed"
}
```
`summary_strategy` のデフォルト: `"detailed"`

**Merge バリデーション:**
- `source_branch_id` と `target_branch_id` は異なるブランチでなければならない（同一 → `400 BAD_REQUEST`）
- source ブランチに base_node_id から head_node_id までのノードが1つ以上必要（空ブランチ → `400 BAD_REQUEST`）
- Gemini API での要約生成が失敗した場合は `502 AI_SERVICE_UNAVAILABLE` を返す（summary ノードは作成しない、head は変更しない）

**Merge レスポンス:**
```json
{
  "node": {
    "id": "uuid",
    "node_type": "summary",
    "user_message": "pricing-discussion ブランチの統合",
    "ai_response": "要約テキスト...",
    "metadata": {
      "merge_source_branch_id": "uuid",
      "merge_source_branch_name": "pricing-discussion",
      "merge_source_head_node_id": "uuid",
      "summary_strategy": "detailed"
    }
  },
  "updated_branch": {
    "id": "uuid",
    "head_node_id": "uuid"
  }
}
```

**Reset リクエスト:**
```json
{
  "branch_id": "uuid",
  "target_node_id": "uuid"
}
```
`target_node_id` はそのブランチの head からルートまでのパス上に存在するノードでなければならない。

**Cherry-pick リクエスト:**
```json
{
  "source_node_id": "uuid",
  "target_branch_id": "uuid"
}
```

**Diff クエリ:**
```
GET /v1/conversations/:id/diff?branch_a=uuid&branch_b=uuid
```

**Diff レスポンス:**
```json
{
  "lca_node_id": "uuid",
  "branch_a": {
    "branch_id": "uuid",
    "name": "main",
    "nodes": [...]
  },
  "branch_b": {
    "branch_id": "uuid",
    "name": "pricing-discussion",
    "nodes": [...]
  }
}
```
`nodes` はLCA以降のノードを時系列順に格納。

### リポジトリ（Repository）

| Method | Path | 説明 | 認証 | MVP |
|--------|------|------|------|-----|
| POST | `/v1/repositories` | リポジトリ作成 | 必須 | Yes |
| GET | `/v1/repositories` | 自分のリポジトリ一覧 | 必須 | Yes |
| GET | `/v1/repositories/:id` | リポジトリ詳細 | 条件付き | Yes |
| PATCH | `/v1/repositories/:id` | リポジトリ更新 | 必須 | Yes |
| DELETE | `/v1/repositories/:id` | リポジトリ削除 | 必須 | Yes |
| GET | `/v1/repositories/:id/branches` | リポジトリのブランチ一覧 | 条件付き | Yes |
| GET | `/v1/repositories/:id/nodes` | リポジトリの全ノード（RepositoryNode） | 条件付き | Yes |

> 「条件付き」= public ならば認証不要、private は認証+所有者チェック。未認証で private にアクセスした場合は `404 NOT_FOUND`（`403` ではなく、リポジトリの存在を隠すため）。

**GET /v1/repositories/:id/nodes レスポンス:**
RepositoryNode をブランチごとにグループ化して返す。Conversation の Node とは独立したデータ。

```json
{
  "branches": [
    {
      "repository_branch_id": "uuid",
      "name": "main",
      "nodes": [
        {
          "id": "uuid",
          "parent_repository_node_id": null,
          "node_type": "message",
          "user_message": "...",
          "ai_response": "...",
          "model": "gemini-2.5-flash",
          "token_count": 500,
          "metadata": null,
          "branch_color": "#3b82f6",
          "original_created_at": "2026-03-18T00:00:00Z"
        }
      ]
    }
  ]
}
```

> `branch_color` はバックエンド側で `RepositoryBranch.id` をハッシュして HSL カラーを生成し、レスポンスに含める。

### Push

| Method | Path | 説明 | 認証 | MVP |
|--------|------|------|------|-----|
| POST | `/v1/repositories/:id/push` | 会話をリポジトリにpush | 必須 | Yes |

**リクエスト:**
```json
{
  "conversation_id": "uuid",
  "branch_ids": ["uuid", "uuid"]
}
```

- `branch_ids` を省略または空配列の場合、**全ブランチをpush**
- 同一 `repository_id` + `source_branch_id` の組み合わせが既に存在する場合、既存の RepositoryNode を全削除して新しいノード群で置換（UPSERT）

**Push レスポンス:**
```json
{
  "pushed_branches": [
    {
      "repository_branch_id": "uuid",
      "name": "main",
      "node_count": 12,
      "pushed_at": "2026-03-18T00:00:00Z"
    }
  ]
}
```

### 検索

| Method | Path | 説明 | 認証 | MVP |
|--------|------|------|------|-----|
| GET | `/v1/search` | 会話・ノードの全文検索 | 必須 | Yes |

**クエリパラメータ:**
- `q`: 検索キーワード（必須）
- `scope`: `conversations`（タイトル検索）/ `nodes`（メッセージ内容検索）/ `all`（両方、デフォルト）
- `cursor`, `limit`: ページネーション

**レスポンス:**
```json
{
  "conversations": [
    { "id": "uuid", "title": "...", "matched_field": "title" }
  ],
  "nodes": [
    {
      "id": "uuid",
      "conversation_id": "uuid",
      "conversation_title": "...",
      "branch_name": "...",
      "user_message_excerpt": "...マッチした部分...",
      "ai_response_excerpt": "...マッチした部分..."
    }
  ],
  "has_more": false
}
```

**検索結果のソート順:** 更新日時の降順（最新の会話・ノードが上位）。将来的に PostgreSQL の `ts_rank` による関連度スコアでのランキングを追加予定。

### DB保存リトライ

| Method | Path | 説明 | 認証 | MVP |
|--------|------|------|------|-----|
| POST | `/v1/conversations/:id/retry-save` | ストリーミング成功後のDB保存失敗時のリトライ | 必須 | Yes |

**リクエスト:**
```json
{
  "branch_id": "uuid",
  "parent_node_id": "uuid",
  "user_message": "ユーザーのメッセージ",
  "ai_response": "AIの応答全文",
  "model": "gemini-2.5-flash",
  "token_count": 1234
}
```

### 公開リポジトリ（MVP後）

| Method | Path | 説明 | 認証 | MVP |
|--------|------|------|------|-----|
| GET | `/v1/explore/repositories` | 公開リポジトリ一覧 | 不要 | No |

> MVP では実装しない。API 定義のみ予約。

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

### エラーコード一覧

| HTTP Status | code | 用途 |
|-------------|------|------|
| 400 | `BAD_REQUEST` | リクエストのバリデーションエラー |
| 400 | `INVALID_MODEL` | 存在しないモデルの指定 |
| 400 | `TOKEN_LIMIT_EXCEEDED` | コンテキストがトークン上限を超過 |
| 401 | `UNAUTHORIZED` | 認証トークンの欠如または無効 |
| 403 | `FORBIDDEN` | リソースへのアクセス権限なし |
| 403 | `DEFAULT_BRANCH_UNDELETABLE` | デフォルトブランチの削除試行 |
| 404 | `NOT_FOUND` | リソースが存在しない |
| 409 | `CONFLICT` | ブランチ名の重複等 |
| 429 | `RATE_LIMITED` | レート制限超過 |
| 500 | `INTERNAL_ERROR` | サーバー内部エラー |
| 502 | `AI_SERVICE_UNAVAILABLE` | Gemini API の障害 |
| 504 | `AI_TIMEOUT` | Gemini API のタイムアウト |
