# 026 - AIモデル調査レポート

## 日時
2026-03-20

## 目的
アプリ内で実際に動作しているAIモデルの現状把握と、追加・修正すべきモデル設定の洗い出し。

---

## 現在サポートされているモデル

### バックエンド（`backend/src/infra/gemini.ts`）

```typescript
const VALID_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'] as const;
const getDefaultModel = (): string => process.env.GEMINI_MODEL || 'gemini-2.5-flash';
```

| モデルID | バックエンド | フロントエンドUI | 用途 |
|---------|:-----------:|:--------------:|------|
| `gemini-2.5-flash` | ✅ | ✅「2.5 Flash / 高速・低コスト」 | デフォルト |
| `gemini-2.5-pro` | ✅ | ✅「2.5 Pro / 高精度・推論向け」 | ユーザー選択 |
| `gemini-2.0-flash` | ✅ | ❌ 表示なし | バックエンドのみ |
| `gemini-2.0-flash-lite` | ✅ | ❌ 表示なし | バックエンドのみ |

### フロントエンド（`frontend/app/conversation/_compornents/message-input.tsx`）

```typescript
const MODELS = [
  { value: 'gemini-2.5-flash', label: '2.5 Flash', description: '高速・低コスト' },
  { value: 'gemini-2.5-pro',   label: '2.5 Pro',   description: '高精度・推論向け' },
] as const;
```

UIには `gemini-2.5-flash` と `gemini-2.5-pro` の2択のみ表示。

---

## 認証方式の現状

`@google/genai` SDK（`^1.46.0`）を使用し、**`vertexai: true`** で Vertex AI 経由のサービスアカウント認証を行っている。

```typescript
const getClient = (): GoogleGenAI =>
  new GoogleGenAI({ vertexai: true, project: getProjectId(), location: getLocation() });
```

- API キー（`GEMINI_API_KEY`）は不要
- GCP_PROJECT_ID・GCP_LOCATION 環境変数で接続先を指定
- Cloud Run のサービスアカウントに `roles/aiplatform.user` が付与されている前提

---

## 発見された問題点

### 🔴 重大：環境変数に存在しないモデルが設定されている

| 場所 | 設定値 | 問題 |
|------|--------|------|
| `backend/.env` | `GEMINI_MODEL=gemini-1.5-flash` | `VALID_MODELS` に含まれないため、チャット送信時に `INVALID_MODEL` エラーが発生する |
| `terraform/environments/dev/main.tf` | `GEMINI_MODEL=gemini-1.5-flash` | 本番デプロイ時も同じエラーが起きる |
| `backend/src/scripts/vertex-smoke.ts` | `GEMINI_MODEL ?? 'gemini-1.5-flash'` | スモークテストがエラーになる |

`gemini-1.5-flash` は過去の実装では対応していたが、現在の `VALID_MODELS` から除外されている。

### 🟡 軽微：バックエンドとフロントエンドのモデル定義が分離している

- バックエンドの `VALID_MODELS` にあるが UI に表示されないモデル（`gemini-2.0-flash`、`gemini-2.0-flash-lite`）が存在する
- 将来モデルを追加するたびにフロントエンドとバックエンドの両方を修正する必要がある

---

## 今後の対応候補

### 即時対応（バグ修正）
- [ ] `backend/.env` の `GEMINI_MODEL` を `gemini-2.5-flash` に修正
- [ ] `terraform/environments/dev/main.tf` の `GEMINI_MODEL` を `gemini-2.5-flash` に修正
- [ ] `backend/src/scripts/vertex-smoke.ts` のデフォルトモデルを `gemini-2.5-flash` に修正

### 検討事項（機能改善）
- [ ] UIのモデル選択肢に `gemini-2.0-flash` / `gemini-2.0-flash-lite` を追加するか検討
- [ ] バックエンドの `VALID_MODELS` とフロントエンドの `MODELS` 定義を共通化する仕組みを検討
- [ ] Googleの新モデル（例: `gemini-2.5-pro-exp-03-25` 等）の追加を検討

---

## 調査対象ファイル

- `backend/src/infra/gemini.ts`
- `backend/src/service/chat.service.ts`
- `backend/src/service/git-operations.service.ts`
- `backend/.env`
- `backend/package.json`
- `terraform/environments/dev/main.tf`
- `frontend/app/conversation/_compornents/message-input.tsx`
- `frontend/app/conversation/_hooks/use-chat-handler.ts`
- `docs/specs/04-ai-integration.md`
- `docs/open-issues/vertexai.md`
