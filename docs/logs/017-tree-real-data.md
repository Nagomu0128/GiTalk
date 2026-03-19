# 017 - /tree モックを実データ化し、dashboard から遷移可能にする

## 日付
2026-03-19

## 概要
`/tree` ページのモックデータを実際の会話データに置き換え、dashboard の会話カードクリックで `/tree/[id]` に遷移するよう変更。

## 変更内容

### 1. `frontend/app/tree/[id]/page.tsx` (新規作成)
- 動的ルート `[id]` に移行
- `useParams()` で `conversationId` を取得
- API からデータ取得 (`GET /api/v1/conversations/:id`, `/branches`, `/nodes`)
- `Branch[] → GitBranch[]` 変換: ブランチIDのハッシュベースHSLカラー
- `ConversationNode[] → GitNode[]` 変換:
  - `branchIndex` = branchId → 配列インデックス
  - `column` = parentId チェーンを辿った深さ（メモ化あり）
  - `parentIds` = `[node.parentId]`（null でない場合）
- `selectedNodeId` = アクティブブランチの headNodeId
- サイドバー「Dashboard」→ `/dashboard` に遷移
- ヘッダー「チャットに戻る」→ `/conversation/[id]` に遷移
- ローディング・エラー表示対応

### 2. `frontend/app/tree/page.tsx` (削除)
- 動的ルートに移行したため不要

### 3. `frontend/components/cards/conversation-card.tsx` (修正)
- クリック遷移先を `/conversation/${id}` → `/tree/${id}` に変更

## エラー・注意点
- `.next` キャッシュが古いページを参照してTypeScriptエラーが出たが、キャッシュ削除で解消
- `NODE_RADIUS` は未使用だが元のコードからの引き継ぎとして残している
