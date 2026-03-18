# 006 - Session 4: 会話コア（バックエンド）

## 日時
2026-03-18

## 対象タスク
- T2-1: Conversation API（CRUD + soft delete + 復元 + 作成時 "main" ブランチ自動作成）
- T2-2: Branch API（CRUD、遡及的分岐、デフォルトブランチ削除不可、楽観的ロック）
- T2-3: Node API（全ノード取得、ノード詳細、WITH RECURSIVE CTE によるパス取得）
- T2-4: コンテキスト構築ロジック（context-builder.ts, lca.ts）

## 実施内容

### 作成ファイル

| ファイル | レイヤー | 内容 |
|---------|---------|------|
| `infra/conversation.ts` | infra | create, findById, listByOwner, update, softDelete, listDeleted, restore |
| `infra/branch.ts` | infra | create, findById, listByConversation, updateName, updateHead（楽観的ロック）, delete |
| `infra/node.ts` | infra | findById, listByConversation, getPathToRoot（WITH RECURSIVE CTE）, create |
| `domain/lca.ts` | domain | findLCA（2パスの共通祖先を Set で検索） |
| `domain/context-builder.ts` | domain | buildContextContents（full/summary/minimal モード対応）、summary ノード特別扱い（ts-pattern） |
| `routes/conversations.ts` | routes | POST/GET/PATCH/DELETE /v1/conversations, GET /deleted, POST /restore |
| `routes/branches.ts` | routes | POST/GET/PATCH/DELETE /v1/conversations/:conversationId/branches |
| `routes/nodes.ts` | routes | GET /v1/conversations/:conversationId/nodes, /:nodeId, /:nodeId/path |
| `index.ts` | - | authMiddleware を /v1/* に適用、全ルーターを登録 |

### アーキテクチャ判断
- neverthrow の `Result.match(okFn, errFn)` を使用。ts-pattern の `match().with({ _tag: "Ok" })` は neverthrow の Result と型互換がないため不採用
- Hono の `c.req.param()` は `string | undefined` を返すため、各ルートハンドラの先頭でガードチェックを追加
- `db.execute<NodeRecord>()` の戻り値は RowList（配列ライク）。`.rows` プロパティは存在しないため `[...rows]` でスプレッドして ReadonlyArray に変換
- Conversation 作成はトランザクション内で Conversation INSERT → Branch INSERT → active_branch_id UPDATE を実行

### コーディングルール準拠
- `class`, `let`, `var`, `for`, `while` 不使用
- neverthrow `ResultAsync` でエラーハンドリング
- `errorBuilder` パターンで DBConversationError, DBBranchError, DBNodeError 定義
- ts-pattern は domain 層の nodeToContents（context-builder.ts）で使用
- domain 層は外部レイヤーに依存しない（infra の型のみ import）

## スキップした項目
- **`*.route.ts` ファイル（OpenAPI スキーマ定義）:** SKILL.md で言及されているが、Session 4 の MVP スコープではルートハンドラ内で Zod バリデーションを直接行う方式を採用。OpenAPI 定義は後続セッションで必要に応じて追加
- **service 層:** 現時点では routes から infra を直接呼び出す構成。ビジネスロジックが複雑化する Session 5（AI チャット）以降で service 層を導入予定
- **DB 動作確認:** ローカル PostgreSQL + Firebase 認証が必要なため、API レベルの動作確認は未実施

## 確認結果
- `tsc --noEmit`: パス
- `pnpm lint`: パス
- **API 動作確認: 全テストパス** — フロントエンドから Firebase トークン付きで以下を確認:
  1. 会話作成 → mainブランチ自動作成 + active_branch_id セット ✅
  2. ブランチ一覧取得 → main ブランチ1件 ✅
  3. ノード一覧取得 → 空配列（正常） ✅
  4. 会話一覧取得 → 1件 ✅
  5. Soft Delete → 成功 ✅
  6. 削除済み一覧 → 1件 ✅
  7. 復元 → deletedAt: null に復帰 ✅

## 次のステップ
Session 5: AI チャット バックエンド（T3-1 + T3-2 + T3-3）
