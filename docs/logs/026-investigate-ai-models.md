# 026 - AIモデル調査レポート（更新版）

## 日時
2026-03-20（初版）→ 2026-03-20（更新：.env修正後の再調査）

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

- API キー（`GEMINI_API_KEY`）は**コードで読み取られていない**（後述）
- GCP_PROJECT_ID・GCP_LOCATION 環境変数で接続先を指定
- Cloud Run のサービスアカウントに `roles/aiplatform.user` が付与されている前提

---

## .env 修正後の状態（2026-03-20 更新）

### 修正前 → 修正後

| 変数名 | 修正前 | 修正後 | 状態 |
|--------|--------|--------|------|
| `GEMINI_MODEL` | `gemini-1.5-flash` | `gemini-2.5-flash` | ✅ 解決 |
| `GEMINI_API_KEY` | 未設定 | `AIzaSy...`（設定済み） | ⚠️ 後述 |
| `GCP_LOCATION` | `us-central1` | 未設定 | ✅ コードのデフォルト値で補完 |

---

## 残存する問題点

### 🔴 重大：`GEMINI_API_KEY` は現在のコードで使われていない

`.env` に `GEMINI_API_KEY` が設定されたが、`gemini.ts` の `getClient()` は **Vertex AI 認証（`vertexai: true`）** を使っており、`GEMINI_API_KEY` を読み取るコードが存在しない。

```typescript
// 現在の実装：GEMINI_API_KEY を使っていない
const getClient = (): GoogleGenAI =>
  new GoogleGenAI({
    vertexai: true,           // Vertex AI 経由
    project: getProjectId(),  // GCP_PROJECT_ID を使用
    location: getLocation(),  // GCP_LOCATION を使用
  });
```

`GEMINI_API_KEY` を使うには、以下のように変更が必要：

```typescript
// API キー認証に切り替える場合
const getClient = (): GoogleGenAI =>
  new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

→ **どちらの認証方式を使うか、方針を決める必要がある。**

| 認証方式 | メリット | デメリット |
|---------|---------|-----------|
| Vertex AI（現在の実装） | API キー管理不要、GCP 内で完結 | プロジェクトのアクセス問題で 404 が出ていた実績あり |
| API キー（GEMINI_API_KEY） | Google AI Studio で即座に発行可能、動作実績あり | キーの管理が必要 |

### 🔴 重大：Terraform の GEMINI_MODEL が未修正

`terraform/environments/dev/main.tf` の設定が `gemini-1.5-flash` のまま（`VALID_MODELS` に存在しない）。本番デプロイ時にエラーになる。

```terraform
{ name = "GEMINI_MODEL", value = "gemini-1.5-flash" },  // ← 修正が必要
```

### 🟡 軽微：バックエンドとフロントエンドのモデル定義が分離している

- バックエンドの `VALID_MODELS` にあるが UI に表示されないモデルが存在する（`gemini-2.0-flash`、`gemini-2.0-flash-lite`）
- 将来モデルを追加するたびにフロントエンドとバックエンドの両方を個別に修正する必要がある

---

## 今後の対応候補

### 即時対応（バグ修正）
- [ ] 認証方式の方針決定：Vertex AI（`vertexai: true`）か API キー（`GEMINI_API_KEY`）か
  - Vertex AI を使う場合：`.env` の `GEMINI_API_KEY` は不要
  - API キーを使う場合：`gemini.ts` の `getClient()` を修正
- [ ] `terraform/environments/dev/main.tf` の `GEMINI_MODEL` を `gemini-2.5-flash` に修正

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
