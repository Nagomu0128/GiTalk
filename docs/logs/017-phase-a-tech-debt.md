# 017 - Phase A: 技術的負債の解消

## 日時
2026-03-19

## 対象タスク
- B-01: specs ドキュメントの実装差分を反映
- B-02: merge 要約ノードの token_count 修正
- B-03: Cloud Build マイグレーションステップ追加

## 実施内容

### B-01: specs 更新

| ファイル | 変更内容 |
|---------|---------|
| `04-ai-integration.md` | Vertex AI → Google AI SDK、モデル名 `gemini-2.5-flash`、SDK コード例更新 |
| `07-api-design.md` | 全 `gemini-1.5-flash` → `gemini-2.5-flash`、`gemini-1.5-pro` → `gemini-2.5-pro` |
| `08-infrastructure.md` | `GEMINI_API_KEY` を Secret Manager 管理の環境変数に追加。Gemini API セクションを Google AI SDK ベースに更新。DATABASE_URL の Unix ソケット形式の注意事項追記 |
| `12-development-guide.md` | `.env` の例を更新（GEMINI_API_KEY 追加、GCP_PROJECT_ID 修正、GEMINI_MODEL 更新）。Gemini API セクションを Google AI SDK ベースに更新。環境変数一覧を更新 |

### B-02: merge token_count 修正

- `infra/gemini.ts` に `generateContentWithMetadata` を追加（テキスト + トークン数を返す）
- `service/git-operations.service.ts` の `mergeBranches` で `generateContent` → `generateContentWithMetadata` に変更
- `tokenCount: 0` → `tokenCount: summaryTokenCount` に修正

### B-03: Cloud Build マイグレーション

- `cloudbuild.yaml` に DB マイグレーションステップを追加（lint → migration → build → push → deploy）
- `availableSecrets` で Secret Manager の `DATABASE_URL` を参照
- `drizzle.config.ts` を Cloud SQL Unix ソケット URL 形式に対応（URL をパースして個別の接続パラメータに分解）

## スキップした項目
- **Cloud Build マイグレーションの E2E 確認:** Cloud Build から Cloud SQL への接続テストは未実施。Unix ソケット形式の URL でも drizzle-kit が個別パラメータ形式で接続できるかは実際のデプロイで確認が必要

## 確認結果
- `tsc --noEmit`: パス
- `pnpm lint`: パス
