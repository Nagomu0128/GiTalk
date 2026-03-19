# 000 - 解決済みの課題

## Vertex AI が使用できない問題 【解決済み: 2026-03-20】

### 概要
specs（04-ai-integration.md）では Gemini API を Vertex AI 経由（`@google-cloud/vertexai`）で使用する設計だったが、実際にはプロジェクトからモデルにアクセスできず、Google AI SDK（`@google/generative-ai`）+ API キーベースに切り替えた。

### 発生した現象
- プロジェクト `gitalk-01100128` で Vertex AI API（`aiplatform.googleapis.com`）は有効化済み
- ADC（Application Default Credentials）の認証トークンは正常に取得可能
- 以下の全モデル・全リージョンで 404 Not Found が返る:
  - `gemini-1.5-flash` @ `asia-northeast1` → 404
  - `gemini-1.5-flash` @ `us-central1` → 404
  - `gemini-2.0-flash` @ `us-central1` → 404
  - `gemini-2.0-flash-001` @ `us-central1` → 404
  - `gemini-2.0-flash` @ `asia-northeast1` → 404
- エラーメッセージ: `Publisher Model projects/gitalk-01100128/locations/us-central1/publishers/google/models/gemini-2.0-flash was not found or your project does not have access to it`
- 一方、同プロジェクトの Firebase API キーでは `generativelanguage.googleapis.com` が `API_KEY_SERVICE_BLOCKED` で拒否
- Google AI Studio で別途作成した API キーでは `gemini-2.5-flash` が正常動作

### 原因（推定）
- Firebase プロジェクトである `gitalk-01100128` では Vertex AI のモデルアクセスに必要な課金設定や利用規約同意が未完了の可能性
- Firebase プロジェクト固有の制限の可能性

### 対応内容（fix/vertex-ai ブランチ）
- `@google-cloud/vertexai` → `@google/generative-ai`（Google AI SDK）に移行
- `GEMINI_API_KEY` 環境変数で認証（Google AI Studio 発行の API キー）
- デフォルトモデルを `gemini-2.5-flash` に変更
- Terraform: `GEMINI_API_KEY` を Secret Manager に追加、Cloud Run に注入
- Terraform: Vertex AI IAM ロール（`roles/aiplatform.user`）をコメントアウト
- specs（04, 08, 12）を Google AI SDK ベースに更新

### 将来的な対応
- Vertex AI の課金・利用規約問題が解決した場合、Vertex AI（サービスアカウント認証）に戻すことも可能
  - その場合は Terraform の Vertex AI IAM コメントを復活させ、`@google-cloud/vertexai` を再導入する
