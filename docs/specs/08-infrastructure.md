# 08 - インフラ・デプロイ設計

## 概要

既存の GCP + Terraform インフラ基盤をベースに、アプリケーション固有の要件に対応する。

## 現在のインフラ構成（既存）

| リソース | サービス | 用途 |
|---------|---------|------|
| フロントエンド | Firebase App Hosting | Next.js のホスティング |
| バックエンド | Cloud Run | Hono.js API サーバー |
| データベース | Cloud SQL (PostgreSQL 15) | データ永続化 |
| コンテナレジストリ | Artifact Registry | Docker イメージ管理 |
| CI/CD | Cloud Build | GitHub push → 自動デプロイ |
| シークレット | Secret Manager | API キー等の管理 |
| ストレージ | Cloud Storage | 静的アセット |

## 追加で必要なインフラ要件

### Gemini API

- **Google AI SDK**（`@google/generative-ai`）を使用（Vertex AI SDK は使用しない）
- **Secret Manager** に `GEMINI_API_KEY`（Google AI Studio で発行した API キー）を格納
- Cloud Run のサービスアカウントに Secret Manager のアクセス権限を付与

> **Note:** Vertex AI 経由（`@google-cloud/vertexai`）は使用しない。
> プロジェクト `gitalk-01100128` で Vertex AI のモデルアクセスが 404 を返すため、
> Google AI Studio の API キーを使用する方式に切り替えた。

### Firebase Authentication

- Firebase プロジェクト（既存: gitalk-01100128）に Authentication を有効化
- バックエンドに Firebase Admin SDK を導入（サービスアカウントキーを Secret Manager で管理）

### Cloud SQL 接続

- Cloud Run → Cloud SQL は Cloud SQL Auth Proxy（自動組み込み）で接続
- 接続文字列を環境変数として Cloud Run に設定

### データベースマイグレーション

- **Drizzle Kit** を使用（Drizzle ORM と統合）
- CI/CD パイプライン（Cloud Build）のデプロイ前ステップでマイグレーションを実行
- ロールバック: Drizzle Kit にはロールバック機能がないため、修正用の新しいマイグレーションを作成して対応

## 環境構成

| 環境 | 用途 | コスト方針 |
|------|------|-----------|
| dev | 開発・テスト | 最小構成（現在のTerraform設定） |
| prod | 本番 | スケーラビリティ確保（将来） |

MVP では dev 環境のみで進行。

## CI/CD パイプライン（更新）

```
GitHub Push (main)
    │
    ├── Frontend: Firebase App Hosting（自動デプロイ）
    │
    └── Backend: Cloud Build
            │
            ├── 1. DB マイグレーション実行
            ├── 2. Docker ビルド
            ├── 3. Artifact Registry に push
            └── 4. Cloud Run にデプロイ
```

## 環境変数一覧

### Backend (Cloud Run)

| 変数名 | 説明 | 管理方法 |
|--------|------|---------|
| DATABASE_URL | Cloud SQL 接続文字列 | Secret Manager |
| GEMINI_API_KEY | Google AI Studio API キー | Secret Manager |
| FIREBASE_PROJECT_ID | Firebase プロジェクトID | 環境変数 |
| GCP_PROJECT_ID | GCP プロジェクトID | 環境変数 |
| GEMINI_MODEL | デフォルトのGeminiモデル | 環境変数 |

### Frontend (Firebase App Hosting)

| 変数名 | 説明 |
|--------|------|
| BACKEND_URL | バックエンドAPI URL |
| NEXT_PUBLIC_FIREBASE_CONFIG | Firebase クライアント設定（公開可） |

## コスト見積もり（開発段階）

| リソース | 無料枠 / コスト |
|---------|----------------|
| Cloud Run | 月200万リクエスト無料、cpu_idle=true |
| Cloud SQL (db-f1-micro) | ~$10/月 |
| Gemini API (2.5 Flash) | 入力: $0.15/100万tokens、出力: $0.60/100万tokens |
| Gemini API (1.5 Flash) | 入力: $0.075/100万tokens、出力: $0.30/100万tokens |
| Gemini API (1.5 Pro) | 入力: $1.25/100万tokens、出力: $5.00/100万tokens |
| Firebase Auth | 月50,000 MAU 無料 |
| Firebase App Hosting | 無料枠あり |

> 開発段階では Gemini 2.5 Flash をデフォルトにする。
