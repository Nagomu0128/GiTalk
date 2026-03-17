# CI/CD仕様書

- `frontend`,`backend`の２本のパイプラインを作成。並列実行
- アプリケーションのみに適用する。インフラは手動管理。
- CIはGitHub Actions、CDはCloud Buildで運用する。
- キャッシュ戦略は現時点では規模が小さいため行わない
- 10分を超えるビルドは打ち切る

## 環境変数・シークレットの保護

Secret Managerと環境変数を秘匿度に応じて分離する。

- **シークレット（漏洩時に被害が出るもの）**: Secret Managerで管理
  - 例: DATABASE_URL, APIキー, Webhook URL
  - Cloud Runへは起動時にSecret Managerから注入
  - Cloud Buildへは`availableSecrets`で注入
- **環境変数（漏洩しても問題ない設定値）**: Cloud Run設定 / Terraformで管理
  - 例: NODE_ENV, PORT, REGION
- `.env`ファイルはGitにコミットしない（`.gitignore`に追加）

## ブランチ保護

GitHub Branch Rulesで`main`への直接pushを禁止し、PRマージのみに制限する。

## 通知

ログで確認する

## backendパイプライン

### trigger

CI: PR作成
CD: `main`にマージ

### job

#### CI

テストフレームワーク未選定のため、testは一旦外す

1. lint
2. docker build（pushなし、ビルド確認のみ）

#### CD

1. lint
2. test
3. docker build & push（Artifact Registry）
4. Cloud Runデプロイ

### ロールバック戦略

デプロイ失敗時にCloud Runの前リビジョンに戻す。

- デプロイ後にログを確認し、問題があれば手動でロールバックする

## frontendパイプライン

### trigger

CI: PR作成
CD: `main`にマージ

### job

#### CI

テストはなしで開発

1. lint
2. build確認

#### CD

1. lint
2. build
3. Firebase Hostingにデプロイ

### ロールバック戦略

Firebase Hostingの前リリースに戻す

- デプロイ後にログを確認し、問題があれば手動でロールバックする
