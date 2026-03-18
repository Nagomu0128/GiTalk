# 04 - AI連携・コンテキスト管理

## 概要

Gemini API を使用したAIチャット機能と、ツリー構造に基づくコンテキスト管理の設計。

## Gemini API 連携

### 基本フロー

```
1. ユーザーがメッセージを入力
2. 現在のノードからルートまでのパスを取得
3. パス上の全ノードの会話を Gemini API の入力に構築
4. 新しいユーザーメッセージを末尾に追加
5. Gemini API に送信
6. レスポンスを受け取り、新ノードとして保存
```

### コンテキスト構築

```typescript
// 擬似コード: ノードからルートまでのパスを構築
async function buildContext(nodeId: string): Promise<Message[]> {
  const path: Node[] = [];
  let current = await getNode(nodeId);

  while (current !== null) {
    path.unshift(current);
    current = current.parent_id ? await getNode(current.parent_id) : null;
  }

  return path.map(node => [
    { role: "user", parts: [{ text: node.user_message }] },
    { role: "model", parts: [{ text: node.ai_response }] },
  ]).flat();
}
```

### API リクエスト形式

Gemini API の `generateContent` にマルチターン形式で送信:

```typescript
const result = await model.generateContent({
  contents: [
    ...contextMessages,  // ルート→現在ノードまでの履歴
    { role: "user", parts: [{ text: newUserMessage }] }
  ],
});
```

## コンテキスト肥大化対策

### 1. Gemini Context Caching

**概要:** 共通のプレフィックス（ルート→分岐点まで）をキャッシュし、API呼び出しコストを削減。

**適用条件:**
- コンテキストが 32,768 tokens 以上の場合に有効
- 同一ブランチ内の連続した会話で特に効果的
- キャッシュの TTL はデフォルト1時間

**実装方針:**
```
会話パス: [N1] → [N2] → [N3] → [N4] → [新メッセージ]
                                  ↑
           ここまでをキャッシュ ──┘
```

- ノードの `token_count` を蓄積し、パスの合計トークン数を計算
- 閾値を超えた場合にキャッシュを作成
- キャッシュIDをブランチまたはノードに紐づけて再利用

**コスト:**
- キャッシュ保存: 通常入力の約1/4の料金
- キャッシュヒット時: 入力トークンのコストが大幅に削減

### 2. 要約圧縮

**概要:** 古いノードの会話をAIで要約し、コンテキスト量を圧縮する。

**トリガー条件:**
- パスの合計トークン数が設定閾値を超えた場合
- ユーザーが手動で要約を要求した場合

**実装方針:**
- パスの先頭N個のノードを要約して1つの要約テキストに圧縮
- 要約はシステムメッセージとしてコンテキストの先頭に配置
- 元のノードデータは削除せず保持（UIでの閲覧は可能）

```
元のコンテキスト: [N1, N2, N3, N4, N5, N6, N7, N8] (合計 50,000 tokens)

圧縮後:
[要約: N1-N5の内容を3,000 tokensに圧縮] + [N6, N7, N8] (合計 18,000 tokens)
```

### 3. スライディングウィンドウ（ユーザー設定）

**概要:** ユーザーがコンテキストの量を制御できる。

| モード | 説明 |
|--------|------|
| フル | パス上の全ノードをそのまま送信 |
| 要約 | 古いノードを自動要約して圧縮 |
| 最小 | 直近N個のノードのみ送信 |

- デフォルトは「要約」モード
- 会話画面のサイドバーで切替可能

## モデル選択

- MVP では Gemini 1.5 Pro / Gemini 1.5 Flash を選択可能
- モデル選択は会話単位またはメッセージ単位で切替可能
- 使用モデルは `Node.model` に記録

## ストリーミング対応

- Gemini API の `generateContentStream` を使用
- Server-Sent Events (SSE) でフロントエンドにストリーミング
- ストリーミング完了後にノードとして保存

```
Client ←─ SSE ─← Hono Backend ←─ Stream ─← Gemini API
```

## エラーハンドリング

| エラー | 対処 |
|--------|------|
| Rate Limit | リトライ（exponential backoff） |
| Token Limit超過 | 自動要約を提案し、ユーザー確認後に実行 |
| API障害 | エラーメッセージ表示、ノード作成はしない |
| タイムアウト | リトライ or ユーザーに再送信を促す |
