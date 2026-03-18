# 013 - 本番環境デプロイ修正

## 日時
2026-03-19

## 問題
本番環境（Firebase App Hosting + Cloud Run）で会話作成・データ取得が動作しない。

## 発生した問題と対処（時系列）

### 問題1: フロントエンドから API が呼べない
- **症状:** ダッシュボードでデータ取得・会話作成ができない
- **原因:** フロントエンドコードが `NEXT_PUBLIC_BACKEND_URL` を参照しているが、`apphosting.yaml` では `BACKEND_URL`（`NEXT_PUBLIC_` プレフィックスなし）を設定していた。Next.js ではクライアントサイドで使える環境変数は `NEXT_PUBLIC_*` のみ
- **対処:** Next.js の rewrite プロキシ（`/api/*` → `BACKEND_URL/*`）を活用する方式に変更。フロントエンドの全 API 呼出を `/api/v1/...` に変更し、`NEXT_PUBLIC_BACKEND_URL` を不要にした
- **PR:** #24

### 問題2: Cloud SQL 接続エラー（Invalid URL）
- **症状:** `POST /v1/conversations` が 500。ログ: `TypeError: Invalid URL`
- **原因:** Terraform が Secret Manager に保存した `DATABASE_URL` が Cloud SQL Auth Proxy の Unix ソケット形式（`postgresql://app:pass@/gitalk?host=/cloudsql/...`）。`postgres.js` パッケージの URL パーサーがこの形式を解析できない
- **対処:** `db/client.ts` で `?host=` パラメータを検出した場合、URL を分解してオプションオブジェクト形式で `postgres()` に渡すよう修正
- **PR:** #25

### 問題3: Next.js rewrite がビルド時に BACKEND_URL を解決できない
- **症状:** `POST /api/v1/conversations` が 500（フロントエンド側）
- **原因:** `next.config.ts` の rewrites は**ビルド時**に `process.env.BACKEND_URL` を評価する。Firebase App Hosting のビルド環境でこの変数が正しく注入されない場合、destination が `undefined/:path*` になる
- **対処:** rewrites を削除し、Next.js の Route Handler（`/api/[...path]/route.ts`）でプロキシする方式に変更。Route Handler は**ランタイム**で `BACKEND_URL` を読むため確実に動作する
- **PR:** #26

## docs/specs との差分
- **12-development-guide.md:** `next.config.ts` の rewrites 設定は Route Handler プロキシに置き換わった
- **08-infrastructure.md:** `DATABASE_URL` の Cloud SQL Unix ソケット形式に対する追加パース処理が必要

## スキップした項目
- **Cloud Run ログの CLI 確認:** Windows 環境での gcloud logging コマンドが文字化けで動作せず、GCP Console でのログ確認をユーザーに依頼

## 教訓
- Next.js の rewrites はビルド時評価のため、デプロイ環境で環境変数が確実に利用可能かを事前に確認すべき
- Cloud SQL の接続文字列形式は ORM/ドライバーごとに互換性が異なる。`postgres.js` は Unix ソケット URL 形式を直接サポートしない
- ローカル開発で動作しても本番環境で動かないケースは、環境変数の注入タイミング（ビルド時 vs ランタイム）と接続文字列の形式の違いに起因することが多い
