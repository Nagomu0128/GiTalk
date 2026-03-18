# 04 - AI連携・コンテキスト管理

## 概要

Gemini API を使用したAIチャット機能と、ツリー構造に基づくコンテキスト管理の設計。
Gemini API は Vertex AI 経由で使用し、GCP サービスアカウント認証で接続する。

## Gemini API 連携

### 使用モデル

| モデルID | 用途 | 備考 |
|---------|------|------|
| `gemini-1.5-flash` | デフォルト。高速・低コスト | 開発段階ではこちらを優先 |
| `gemini-1.5-pro` | 高品質な応答が必要な場合 | ユーザーが明示的に選択 |

モデルID はそのまま Vertex AI SDK の `getGenerativeModel()` に渡す。

### 基本フロー

```
1. ユーザーがメッセージを入力
2. 現在のブランチの head_node_id からルートまでのパスを取得
3. コンテキストモードに応じてパス上のノードを加工
4. Gemini API の contents にマルチターン形式で構築
5. generateContentStream で送信（ストリーミング）
6. SSE でフロントエンドにチャンクを送信
7. ストリーミング完了後、usage_metadata からトークン数を取得
8. 新ノードを DB に保存し、ブランチの head_node_id を更新
```

### コンテキスト構築

```typescript
// domain/context-builder.ts — neverthrow スタイル
import { ResultAsync } from "neverthrow";

const buildContext = (
  nodeId: string,
  mode: ContextMode,
  getNode: (id: string) => ResultAsync<Node | null, DBError>,
): ResultAsync<Content[], DBError> =>
  getPathToRoot(nodeId, getNode)
    .map((path) => path.filter((node) => node.node_type !== "system"))
    .map((path) => applyContextMode(path, mode))
    .map((processedPath) =>
      processedPath.flatMap((node) => [
        { role: "user" as const, parts: [{ text: node.user_message }] },
        { role: "model" as const, parts: [{ text: node.ai_response }] },
      ])
    );

// parent_id を辿ってルートまでのパスを WITH RECURSIVE CTE で一括取得
// N+1 クエリを回避し、1クエリでパス全体を取得する
const getPathToRoot = (
  nodeId: string,
  db: DrizzleClient,
): ResultAsync<Node[], DBError> =>
  ResultAsync.fromPromise(
    db.execute(sql`
      WITH RECURSIVE path AS (
        SELECT * FROM node WHERE id = ${nodeId}
        UNION ALL
        SELECT n.* FROM node n
        JOIN path p ON n.id = p.parent_id
      )
      SELECT * FROM path ORDER BY created_at ASC
    `),
    DBError.handle,
  );

// summary ノードのコンテキスト変換
// user_message（システム的テキスト）は使わず、固定のuser文 + ai_response を使用
const nodeToContents = (node: Node): Content[] =>
  match(node.node_type)
    .with("system", () => [])  // system ノードはスキップ
    .with("summary", () => [
      { role: "user" as const, parts: [{ text: `以下は別トピック「${node.metadata?.merge_source_branch_name ?? ""}」の要約です` }] },
      { role: "model" as const, parts: [{ text: node.ai_response }] },
    ])
    .with("message", () => [
      { role: "user" as const, parts: [{ text: node.user_message }] },
      { role: "model" as const, parts: [{ text: node.ai_response }] },
    ])
    .exhaustive();
```

### API リクエスト形式

Vertex AI SDK を使用:

```typescript
import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({ project: GCP_PROJECT_ID, location: 'asia-northeast1' });
const model = vertexAI.getGenerativeModel({ model: selectedModel });

const result = await model.generateContentStream({
  contents: [
    ...contextMessages,  // ルート→現在ノードまでの履歴
    { role: "user", parts: [{ text: newUserMessage }] }
  ],
});
```

## コンテキストモード

ユーザーがメッセージ送信時に選択できる。デフォルトは `summary`。

### full（フルコンテキスト）

- パス上の全ノード（`system` 以外）をそのまま送信
- コンテキスト圧縮は一切適用しない
- トークン数が多くなるためコストが高い
- Gemini Context Caching のみ適用可能

### summary（要約モード、デフォルト）

- パスの合計トークン数が **100,000 tokens** を超えた場合に自動圧縮
- 圧縮対象: パスの先頭から、残りが **80,000 tokens** 以下になるまでのノード
- 圧縮したノード群は以下のプロンプトで要約:

```
以下はこれまでの会話の要約です。この要約を踏まえて、ユーザーの次の質問に答えてください。

要約:
{Gemini API で生成した要約テキスト}
```

- 要約はコンテキストの先頭にシステムメッセージとして配置
- 元のノードデータは DB 上ではそのまま保持（UI での閲覧は可能）

```
元のコンテキスト: [N1, N2, N3, N4, N5, N6, N7, N8] (合計 120,000 tokens)

圧縮後:
[要約: N1-N5 を 3,000 tokens に圧縮] + [N6, N7, N8] (合計 ~23,000 tokens)
```

### minimal（最小コンテキスト）

- 直近 **10 ノード** のみを送信（設定変更不可、固定値）
- それ以前のノードは完全に無視（要約もしない）
- 最もコストが低いが、文脈が失われるリスクがある

## Gemini Context Caching

**適用条件:** コンテキストの合計トークン数が **32,768 tokens** 以上の場合に自動適用。コンテキストモードに関係なく適用される。

**キャッシュ対象:** コンテキストの先頭から末尾の1つ前のノードまで（プレフィックス部分）。最新のノード + 新しいメッセージは毎回送信。

**キャッシュ管理:**
- キャッシュ ID はサーバーのメモリ上で保持（Map<branchId, cacheId>）
- TTL: 1 時間（Gemini のデフォルト）
- TTL 切れの場合は自動的に再作成
- ブランチが切り替わった場合はキャッシュを再作成

**コスト:**
- キャッシュ保存: 通常入力の約 1/4 の料金
- キャッシュヒット時: 入力トークンのコストが大幅に削減

## モデル選択

- MVP では `gemini-1.5-flash`（デフォルト）と `gemini-1.5-pro` を選択可能
- モデル選択はメッセージ単位で切替可能（メッセージ入力エリアのドロップダウン）
- 使用モデルは `Node.model` に記録
- merge の要約生成には送信時に選択中のモデルを使用

## ストリーミング対応

### シーケンス

```
Client                    Hono Backend                  Gemini API (Vertex AI)
  │                          │                               │
  │  POST /chat              │                               │
  │  (message, branch_id,    │                               │
  │   model, context_mode)   │                               │
  │ ─────────────────────►   │                               │
  │                          │  buildContext()                │
  │                          │  ──────────────►               │
  │                          │  ◄──────────────               │
  │                          │                               │
  │                          │  generateContentStream()       │
  │                          │  ─────────────────────────────►│
  │                          │                               │
  │  SSE: {type: "chunk",    │  ◄── stream chunk ────────── │
  │        content: "..."}   │                               │
  │ ◄────────────────────    │                               │
  │                          │                               │
  │  SSE: {type: "chunk",    │  ◄── stream chunk ────────── │
  │        content: "..."}   │                               │
  │ ◄────────────────────    │                               │
  │                          │                               │
  │                          │  ◄── stream end ──────────── │
  │                          │                               │
  │                          │  usage_metadata からトークン数取得
  │                          │  Node を DB に INSERT          │
  │                          │  Branch.head_node_id を UPDATE │
  │                          │                               │
  │  SSE: {type: "done",     │                               │
  │        node_id: "...",   │                               │
  │        token_count: N}   │                               │
  │ ◄────────────────────    │                               │
```

### SSE イベント形式

```
data: {"type": "chunk", "content": "AIの応答テキストの一部"}

data: {"type": "chunk", "content": "続きのテキスト\n改行も含む"}

data: {"type": "done", "node_id": "uuid-of-new-node", "token_count": 1234}

data: {"type": "error", "code": "STREAM_INTERRUPTED", "message": "ストリーミングが中断されました"}
```

- `content` 内の改行・特殊文字は JSON エンコーディングで処理される
- 各 `data:` 行は1つの JSON オブジェクト

### ストリーミング中断時の挙動

- Gemini API からのストリーミングが中断された場合（ネットワークエラー、タイムアウト等）:
  1. `type: "error"` イベントをクライアントに送信
  2. **ノードは DB に保存しない**（部分的な応答は永続化しない）
  3. ブランチの `head_node_id` は変更しない
  4. フロントエンドはエラーメッセージを表示し、再送信ボタンを表示

## トークンカウント

- `Node.token_count` には `user_message` + `ai_response` の合計トークン数を保存
- Gemini API の `generateContentStream` 完了時の `usage_metadata.totalTokenCount` から取得
- merge の要約ノードでは、要約後のテキストに対するトークン数を保存

## エラーハンドリング

| エラー | HTTP Status | エラーコード | 対処 |
|--------|------------|-------------|------|
| Rate Limit | 429 | `RATE_LIMITED` | リトライ（exponential backoff、最大3回） |
| Token Limit超過 | 400 | `TOKEN_LIMIT_EXCEEDED` | コンテキストモードを `summary` または `minimal` に変更するよう促す |
| API障害 | 502 | `AI_SERVICE_UNAVAILABLE` | エラーメッセージ表示、ノード作成はしない |
| タイムアウト | 504 | `AI_TIMEOUT` | ユーザーに再送信を促す |
| ストリーミング中断 | - | `STREAM_INTERRUPTED` | SSE error イベント送信、ノード保存しない |
| 不正なモデル指定 | 400 | `INVALID_MODEL` | エラーメッセージ表示 |
