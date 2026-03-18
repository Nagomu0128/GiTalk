# 000 - 未解決の課題

## Vertex AI が使用できない問題

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

### 現在の暫定対応
- `@google/generative-ai`（Google AI SDK）+ API キーベースで Gemini API を呼び出す
- デフォルトモデルを `gemini-2.5-flash` に変更
- `GEMINI_API_KEY` 環境変数を追加（`.env` および将来的に Secret Manager で管理）

### 影響範囲
- ローカル開発: 問題なし（API キーで動作確認済み）
- Cloud Run デプロイ: `GEMINI_API_KEY` を Secret Manager に追加する必要がある（Terraform 修正必要）
- specs との乖離: 04-ai-integration.md、08-infrastructure.md、12-development-guide.md の記述が実装と不一致

### 未調査の原因候補
- プロジェクトの課金設定が Vertex AI のモデルアクセスに必要な条件を満たしていない可能性
- Vertex AI の利用規約への同意が未完了の可能性
- プロジェクトが Firebase プロジェクトであることによる制限の可能性
- リージョン別のモデル可用性の問題（ただし us-central1 でも 404）

### 今後の対応
- [ ] GCP Console で Vertex AI のモデルガーデンから直接モデルにアクセスできるか確認
- [ ] 課金アカウントの設定・利用規約の同意状況を確認
- [ ] 解決した場合、Vertex AI（サービスアカウント認証）に戻し、API キーを不要にする
- [ ] 解決しない場合、specs を Google AI SDK ベースに更新する
- [ ] Cloud Run デプロイ用に GEMINI_API_KEY を Secret Manager + Terraform で管理する
