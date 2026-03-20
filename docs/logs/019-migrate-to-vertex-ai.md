# 019 - Vertex AI SDK への完全移行

## 日時
2026-03-20

## 対象タスク
- B-18: Vertex AI 移行の再調査（13-beyond-mvp.md）
- docs/open-issues/vertexai.md の解決

## 原因特定
Session 5 で Vertex AI が使えなかった原因は **Model Garden での利用規約同意（注文）が未完了** だったため。GCP Console → Vertex AI → Model Garden で Gemini モデルの「注文」を完了したことで API アクセスが可能になった。

## 実施内容

### SDK 移行
- `@google/generative-ai`（Google AI SDK）→ `@google-cloud/vertexai`（Vertex AI SDK）に完全移行
- 変更ファイル:
  - `infra/gemini.ts`: `GoogleGenerativeAI` → `VertexAI`、`GenerateContentStreamResult` → `StreamGenerateContentResult`
  - `service/chat.service.ts`: Content の import 元を `infra/gemini.js` に変更
  - `service/git-operations.service.ts`: 同上

### 認証方式の変更
- Google AI SDK: `GEMINI_API_KEY`（API キーベース）
- Vertex AI SDK: ADC / サービスアカウント（`GCP_PROJECT_ID` + `GCP_LOCATION`）
- `GEMINI_API_KEY` 環境変数は不要になった

### 環境変数
| 変数 | 旧 | 新 |
|------|-----|-----|
| GEMINI_API_KEY | 必須 | 不要 |
| GCP_PROJECT_ID | 必須 | 必須 |
| GCP_LOCATION | なし | `us-central1`（デフォルト） |

## 確認結果
- `tsc --noEmit`: パス
- `pnpm lint`: パス
- **E2E テスト: パス** — ローカルで会話作成 → Gemini 応答ストリーミング → ノード保存が Vertex AI 経由で動作 ✅

## docs/specs との差分
- `04-ai-integration.md`: Phase A で Google AI SDK に更新済みだが、再度 Vertex AI に戻す更新が必要
- `08-infrastructure.md`: `GEMINI_API_KEY` を削除し、`GCP_LOCATION` を追加
- `12-development-guide.md`: ADC 認証に戻す

## 今後の対応
- [ ] Cloud Run のサービスアカウントで Vertex AI にアクセスできるか本番確認
- [ ] Secret Manager の `gitalk-gemini-api-key` は不要になるため削除可能
- [ ] docs/open-issues/vertexai.md を closed に更新
- [ ] Context Caching の実装が可能に
