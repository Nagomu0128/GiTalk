# 007 - Session 5: AI チャット（バックエンド）

## 日時
2026-03-18

## 対象タスク
- T3-1: Gemini API 連携（infra/gemini.ts）
- T3-2: SSE ストリーミング（Hono streamSSE）
- T3-3: チャット API（POST /v1/conversations/:id/chat + retry-save + タイトル自動生成）

## 実施内容

### パッケージ追加
- `@google/generative-ai`: Google AI SDK（Gemini API 呼出用）
- `dotenv`: .env ファイル読み込み（tsx watch 経由では `--env-file` が動作しないため）
- `@google-cloud/vertexai`: 当初使用予定だったが、プロジェクトのアクセス問題で不採用（依存は残存）

### 作成・修正ファイル

| ファイル | 内容 |
|---------|------|
| `infra/gemini.ts` | Google AI SDK（`@google/generative-ai`）で `generateContentStream` / `generateContent` を実装。環境変数は関数内で遅延読み込み |
| `service/chat.service.ts` | コンテキスト構築 → Gemini ストリーミング → ノード保存 → head 更新 → タイトル自動生成。async コールバック方式 |
| `routes/chat.ts` | POST `/v1/conversations/:conversationId/chat`（SSE）、POST `/v1/conversations/:conversationId/retry-save` |
| `infra/branch.ts` | `updateBranchHead` の楽観的ロック修正: `expectedHeadNodeId === null` 時に `isNull()` を使用 |
| `index.ts` | `import 'dotenv/config'` 追加、chatRouter 登録 |
| `package.json` | dev スクリプトを `tsx watch` に戻し（dotenv で .env 読み込み） |
| `.env` | GEMINI_API_KEY, GEMINI_MODEL 等を追加（.gitignore で除外） |

### 開発中に発生した問題と対処

1. **Vertex AI 404 エラー:** `gemini-1.5-flash` / `gemini-2.0-flash` が Vertex AI で見つからない。プロジェクトのアクセス設定問題。→ Google AI SDK（API キーベース）に切替
2. **GCP_PROJECT_ID のデフォルト値が `gjh-hack`（存在しない）:** → `gitalk-01100128` に修正
3. **環境変数がモジュール読込時に評価される:** `GEMINI_API_KEY` がトップレベルの `const` で即座に読まれ、`.env` 読込前に空になる → 関数内で `process.env` を毎回読むよう修正
4. **`--env-file` が tsx watch 経由で動作しない:** pnpm がフラグを消す → `dotenv/config` を index.ts 先頭で import する方式に変更
5. **楽観的ロックの null 比較バグ:** `headNodeId` が `null`（初回メッセージ）のとき `eq(col, null)` では SQL が `col = NULL` になり一致しない → `isNull(col)` に修正
6. **SSE コールバックが await されていない:** ストリームが閉じた後にイベントが書き込まれる → コールバック型を `Promise<void> | void` にし、全呼出を await

### コーディングルール準拠
- `class`, `let`, `var` 不使用（`for await...of` はストリーミング処理に必要なため使用）
- neverthrow `ResultAsync` でエラーハンドリング
- `errorBuilder` パターンで GeminiError, ChatError 定義

## スキップした項目
- **Vertex AI SDK の利用:** プロジェクトのアクセス問題で断念。`@google-cloud/vertexai` は依存に残存（将来の Cloud Run デプロイ時に再検討）
- **Gemini Context Caching:** T8-3 で対応予定
- **summary モードの自動要約 Gemini 呼出:** 未実装
- **タイトル自動生成:** `generateTitle` を await してストリーム内で完了を待つよう修正。E2E テストで `[title_generated]` SSE イベントの受信と DB 更新を確認済み

## 確認結果
- `tsc --noEmit`: パス
- `pnpm lint`: パス
- **E2E チャットテスト: パス**
  1. 会話作成 → mainブランチ + active_branch_id ✅
  2. チャット送信 → SSE ストリーミングで Gemini 応答受信 ✅
  3. ノード保存 → DB に1件保存確認 ✅
  4. ブランチ head 更新 → node_id 一致 ✅

## docs/specs との差分

specsで定義した仕様と実際の実装が異なる箇所を記録する。

| specs の記述 | 実際の実装 | 理由 |
|-------------|-----------|------|
| **04-ai-integration.md:** Vertex AI 経由で Gemini API を使用（`@google-cloud/vertexai`） | Google AI SDK（`@google/generative-ai`）+ API キーベース | Vertex AI でプロジェクト `gitalk-01100128` から全モデルが 404/403 になる問題が解決できなかったため。Cloud Run デプロイ時に再検討が必要 |
| **04-ai-integration.md:** モデル `gemini-1.5-flash` / `gemini-1.5-pro` | `gemini-2.5-flash` がデフォルト。`gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-2.5-pro` もサポート | `gemini-1.5-flash` / `gemini-2.0-flash` が利用不可（404）。`gemini-2.5-flash` が最新の利用可能モデル |
| **08-infrastructure.md:** 環境変数 `GEMINI_MODEL` のみ | `GEMINI_API_KEY` 環境変数が追加で必要 | Vertex AI（サービスアカウント認証）→ Google AI（API キー認証）に変更したため |
| **08-infrastructure.md:** Cloud Run 環境変数に `GEMINI_MODEL` のみ記載 | Cloud Run に `GEMINI_API_KEY` を Secret Manager 経由で設定する必要がある | API キーベースに変更したため。Terraform の Secret Manager モジュールで管理すべき |
| **12-development-guide.md:** `gcloud auth application-default login` で Vertex AI にアクセス | `.env` に `GEMINI_API_KEY` を設定 | ADC では Google AI SDK は使えないため。ローカル開発では `.env` ファイルで管理 |
| **04-ai-integration.md:** Vertex AI SDK の `VertexAI` クラスを使用 | `GoogleGenerativeAI` クラス（`@google/generative-ai`）を使用 | SDK が異なるため API も異なる。`generateContentStream` の戻り値の型名が `StreamGenerateContentResult` → `GenerateContentStreamResult` |
| **07-api-design.md:** チャットのデフォルトモデル `gemini-1.5-flash` | デフォルトモデル `gemini-2.5-flash` | モデル可用性に合わせて変更 |

### 今後の対応が必要な項目
- `docs/specs/04-ai-integration.md` のモデル名・SDK 情報を更新すべき
- `docs/specs/08-infrastructure.md` に `GEMINI_API_KEY` 環境変数を追加すべき
- `docs/specs/12-development-guide.md` のローカル開発手順を Google AI SDK ベースに更新すべき
- Cloud Run デプロイ時に `GEMINI_API_KEY` を Secret Manager に追加し、Terraform で管理すべき

## 次のステップ
Session 6: チャット UI + ツリー基盤（T3-4 + T5-1 + T5-2）
