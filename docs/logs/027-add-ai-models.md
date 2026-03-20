# 027 - AIモデルの追加と認証修正

## 日時
2026-03-20

## 背景
調査レポート（026）で判明した以下の問題を修正し、全サポートモデルをアプリ内で使えるようにした。

1. `gemini.ts` が `vertexai: true` を使っており、`.env` の `GEMINI_API_KEY` が無視されていた
2. フロントエンドのモデル選択UIに `gemini-2.0-flash` / `gemini-2.0-flash-lite` が表示されていなかった
3. Terraform の `GEMINI_MODEL` が `gemini-1.5-flash`（非対応モデル）のままだった

## 実施内容

### 1. `backend/src/infra/gemini.ts` — 認証方式を API キーに変更

```typescript
// 変更前：Vertex AI 経由（GEMINI_API_KEY を無視）
const getClient = (): GoogleGenAI =>
  new GoogleGenAI({ vertexai: true, project: getProjectId(), location: getLocation() });

// 変更後：API キー認証
const getClient = (): GoogleGenAI => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');
  return new GoogleGenAI({ apiKey });
};
```

- `GCP_PROJECT_ID` / `GCP_LOCATION` への依存を `getClient()` から除去
- `GEMINI_API_KEY` 未設定時に明示的なエラーを投げるように修正

### 2. `frontend/app/conversation/_compornents/message-input.tsx` — モデル選択肢を追加

```typescript
// 変更前：2モデル
const MODELS = [
  { value: 'gemini-2.5-flash', label: '2.5 Flash', description: '高速・低コスト' },
  { value: 'gemini-2.5-pro',   label: '2.5 Pro',   description: '高精度・推論向け' },
]

// 変更後：4モデル（バックエンドの VALID_MODELS と一致）
const MODELS = [
  { value: 'gemini-2.5-flash',     label: '2.5 Flash',      description: '高速・低コスト' },
  { value: 'gemini-2.5-pro',       label: '2.5 Pro',        description: '高精度・推論向け' },
  { value: 'gemini-2.0-flash',     label: '2.0 Flash',      description: 'バランス型' },
  { value: 'gemini-2.0-flash-lite',label: '2.0 Flash Lite', description: '軽量・超低コスト' },
]
```

### 3. `terraform/environments/dev/main.tf` — デフォルトモデルを修正

```terraform
// 変更前
{ name = "GEMINI_MODEL", value = "gemini-1.5-flash" }

// 変更後
{ name = "GEMINI_MODEL", value = "gemini-2.5-flash" }
```

## 現在サポートされているモデル（修正後）

| モデルID | バックエンド | フロントエンドUI | 説明 |
|---------|:-----------:|:--------------:|------|
| `gemini-2.5-flash` | ✅ | ✅ | デフォルト・高速低コスト |
| `gemini-2.5-pro` | ✅ | ✅ | 高精度・推論向け |
| `gemini-2.0-flash` | ✅ | ✅ | バランス型 |
| `gemini-2.0-flash-lite` | ✅ | ✅ | 軽量・超低コスト |

## 動作確認手順

```bash
cd backend
# .env に GEMINI_API_KEY が設定されていることを確認
pnpm ai:smoke   # → success が出ればOK
pnpm dev        # バックエンド起動
```

フロントエンドのメッセージ入力欄のモデルセレクタで4つのモデルが表示されることを確認。
