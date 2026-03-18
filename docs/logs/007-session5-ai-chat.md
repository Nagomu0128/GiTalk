# 007 - Session 5: AI チャット（バックエンド）

## 日時
2026-03-18

## 対象タスク
- T3-1: Gemini API 連携（infra/gemini.ts, Vertex AI SDK）
- T3-2: SSE ストリーミング（Hono streamSSE）
- T3-3: チャット API（POST /v1/conversations/:id/chat + retry-save + タイトル自動生成）

## 実施内容

### パッケージ追加
- `@google-cloud/vertexai`: Vertex AI SDK（Gemini API 呼出用）

### 作成ファイル

| ファイル | レイヤー | 内容 |
|---------|---------|------|
| `infra/gemini.ts` | infra | Vertex AI SDK 初期化、`generateContentStream`（ストリーミング）、`generateContent`（非ストリーミング、タイトル生成用）、`isValidModel` バリデーション |
| `service/chat.service.ts` | service | `processChat`: コンテキスト構築 → Gemini ストリーミング → ノード保存 → head 更新 → タイトル自動生成。コールバック方式で SSE イベントを送信 |
| `routes/chat.ts` | routes | POST `/v1/conversations/:conversationId/chat`（SSE ストリーミング）、POST `/v1/conversations/:conversationId/retry-save`（DB保存リトライ） |
| `index.ts` | - | chatRouter を登録 |

### アーキテクチャ判断
- **コールバック方式:** service 層が `StreamCallbacks` インターフェースで SSE イベント（chunk, done, error, save_failed, title_generated）を通知。routes 層が Hono の `streamSSE` でコールバックを SSE に変換。service 層が Hono に依存しない設計
- **タイトル自動生成:** 初回メッセージ（parentNodeId === null）の場合のみ、非同期で Gemini にタイトル生成を依頼。失敗してもユーザーに通知しない（spec 02-core-features.md 準拠）
- **retry-save:** ストリーミング成功後の DB 保存失敗時に、フロントエンドからテキスト + メタデータを送って保存のみ再実行するエンドポイント
- **楽観的ロック:** `updateBranchHead` で expectedHeadNodeId を使用し、同時書き込みを検出

### コーディングルール準拠
- `class`, `let`, `var` 不使用（`for await...of` はストリーミング処理に必要なため使用）
- neverthrow `ResultAsync` でエラーハンドリング
- `errorBuilder` パターンで GeminiError, ChatError 定義

## スキップした項目
- **Gemini Context Caching:** spec では 32,768 tokens 以上で自動適用とあるが、MVP では未実装（T8-3 で対応予定）
- **summary モードの自動要約圧縮:** context-builder.ts で閾値判定ロジックは実装済みだが、要約生成の Gemini API 呼出は未実装（圧縮が必要な場合はそのまま全ノードを送信）
- **E2E テスト:** Vertex AI への接続（GCP 認証）+ PostgreSQL が必要なため未実施
- **Firebase ビルドスクリプト承認:** `@firebase/util`, `protobufjs` の pnpm approve-builds 未実施（バックエンド側）

## 確認結果
- `tsc --noEmit`: パス
- `pnpm lint`: パス

## 次のステップ
Session 6: チャット UI + ツリー基盤（T3-4 + T5-1 + T5-2）
