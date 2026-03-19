# 017 - fix/vertex-ai: Vertex AI → Google AI SDK 移行

## 日時
2026-03-20

## 目的
Vertex AI SDK（`@google-cloud/vertexai`）が 404 エラーを返す問題の解決。
Google AI SDK（`@google/generative-ai`）+ API キーベースに完全移行する。

## 実施内容

### 1. `backend/src/infra/gemini.ts` の修正
- `@google-cloud/vertexai` から `@google/generative-ai` へ移行
- `VertexAI({ project, location })` → `GoogleGenerativeAI(apiKey)` に変更
- `GCP_PROJECT_ID` / `GCP_LOCATION` 環境変数の代わりに `GEMINI_API_KEY` を使用
- `generateContent` の `result.response` は Promise ではないため `await` を削除（Google AI SDK の仕様）
- `Content` 型を `gemini.ts` から re-export（サービス層が AI SDK に直接依存しないように）

### 2. `backend/package.json` の更新
- `@google-cloud/vertexai` を dependencies から削除
- `ai:smoke` スクリプトを `vertex-smoke.ts` → `gemini-smoke.ts` に変更
- デフォルトモデルを `gemini-2.5-flash` に変更（`GEMINI_MODEL` env のデフォルト値）

### 3. `backend/src/scripts/gemini-smoke.ts` の作成
- 旧 `vertex-smoke.ts` を置き換え
- `GEMINI_API_KEY` の存在確認に変更
- `GCP_PROJECT_ID` / `GCP_LOCATION` への依存を削除

### 4. Terraform の更新（`terraform/environments/dev/`）
- `variables.tf`: `gemini_api_key` 変数を追加（sensitive = true）
- `main.tf`:
  - `module "secret_gemini_api_key"` を追加（Secret Manager に GEMINI_API_KEY を格納）
  - Cloud Run の `secret_env_vars` に `GEMINI_API_KEY` を追加
  - Cloud Run の `GEMINI_MODEL` を `gemini-1.5-flash` → `gemini-2.5-flash` に更新
  - Vertex AI IAM ロール（`roles/aiplatform.user`）をコメントアウト（将来復活可能）

### 5. ドキュメントの更新
- `docs/specs/04-ai-integration.md`: Vertex AI → Google AI SDK へ記述を更新、モデル一覧更新
- `docs/specs/08-infrastructure.md`: Gemini API セクション・環境変数一覧・コスト見積もりを更新
- `docs/specs/12-development-guide.md`: ローカル開発手順から ADC 設定を削除、`GEMINI_API_KEY` 設定手順に変更

### 6. `docs/open-issues/vertexai.md` の更新
- 解決済みとしてステータスを更新
- 対応内容と将来的な Vertex AI 復帰の手順を記録

## 動作確認手順
```bash
cd backend
# .env に GEMINI_API_KEY を設定後
pnpm ai:smoke   # → [gemini-smoke] success { response: 'OK' } が出ればOK
```

## 備考
- サービス層（`chat.service.ts`, `git-operations.service.ts`）は `gemini.ts` 経由で `Content` 型を import するため、AI SDK への直接依存がない
- Vertex AI が将来使えるようになった場合、`gemini.ts` の `getClient()` を差し替えるだけで対応可能
