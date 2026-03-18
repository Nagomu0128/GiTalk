# 015 - 本番環境の Gemini API キー設定

## 日時
2026-03-19

## 問題
本番環境で会話は作成できるが、AI との対話ができない。ブラウザコンソール: `Chat error: AI_SERVICE_UNAVAILABLE AI service is currently unavailable`

## 原因
`GEMINI_API_KEY` がローカルの `backend/.env` にのみ存在し、Cloud Run の環境変数に設定されていなかった。Vertex AI → Google AI SDK に切り替えた際（Session 5）に API キーが必要になったが、Cloud Run への設定を忘れていた。

## 対処
1. `gcloud secrets create gitalk-gemini-api-key` で Secret Manager にシークレット作成
2. `gcloud secrets versions add` でAPIキーの値を追加（Windows で `<<<` ヒアストリングが動作しなかったため `echo -n | --data-file=-` で対応）
3. `gcloud secrets add-iam-policy-binding` で Cloud Run SA にアクセス権限付与
4. `gcloud run services update --update-secrets=GEMINI_API_KEY=gitalk-gemini-api-key:latest` で Cloud Run に環境変数追加

## docs/specs との差分
- **08-infrastructure.md:** 環境変数一覧に `GEMINI_API_KEY` が記載されていない。Secret Manager で管理する旨を追記すべき
- **docs/open-issues/vertexai.md:** 「Cloud Run デプロイ用に GEMINI_API_KEY を Secret Manager + Terraform で管理する」→ 手動で対応済み。Terraform への反映は未実施

## 今後の対応
- [ ] Terraform に `GEMINI_API_KEY` のシークレット管理を追加
- [ ] docs/specs/08-infrastructure.md を更新
