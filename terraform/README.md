# Terraform 構築手順

## ディレクトリ構成

```
terraform/
├── environments/
│   └── dev/                # 開発環境
│       ├── main.tf         # モジュール呼び出し・API有効化
│       ├── variables.tf    # 変数定義
│       ├── outputs.tf      # 出力定義
│       ├── terraform.tfvars         # 実際の設定値（git管理外）
│       └── terraform.tfvars.example # 設定値のサンプル
└── modules/
    ├── artifact_registry/  # Docker イメージレジストリ
    ├── cloud_build/        # CI/CD トリガー
    ├── cloud_run/          # コンテナ実行環境
    ├── cloud_sql/          # PostgreSQL データベース
    ├── cloud_storage/      # オブジェクトストレージ
    └── secret_manager/     # シークレット管理
```

## 構築されるリソース

| リソース | 用途 | コスト最適化 |
|---|---|---|
| Cloud Run | バックエンド API | min=0, cpu_idle=true (リクエストなし時は課金なし) |
| Cloud SQL | PostgreSQL 15 | db-f1-micro, 10GB, バックアップ無効 |
| Artifact Registry | Docker イメージ保存 | 5個保持・5日超過で自動削除 |
| Cloud Build | GitHub push → 自動デプロイ | ビルド時間のみ課金 |
| Cloud Storage | アセット保存 | STANDARD クラス |
| Secret Manager | DATABASE_URL 等の管理 | アクセス回数のみ課金 |

## 手順

### 1. GCP 認証

```bash
gcloud auth login
gcloud auth application-default login
```

### 2. プロジェクトの設定

```bash
gcloud config set project gjh-hack
```

### 3. terraform.tfvars の準備

```bash
cd terraform/environments/dev
cp terraform.tfvars.example terraform.tfvars
```

`terraform.tfvars` を編集して実際の値を設定します。

```hcl
project_id   = "gjh-hack"
region       = "asia-northeast1"
app_name     = "gjh"
github_owner = "Nagomu0128"
github_repo  = "gjh-hack"
db_password  = "強力なパスワードに変更してください"
```

### 4. Terraform 初期化

```bash
cd terraform/environments/dev
terraform init
```

### 5. 実行計画の確認

```bash
terraform plan
```

作成されるリソースを確認してください。

### 6. リソースの作成

```bash
terraform apply
```

`yes` を入力して適用します。Cloud SQL の作成に 5〜10 分程度かかります。

### 7. 出力の確認

適用完了後、以下の情報が出力されます。

```bash
terraform output
```

- `backend_url` — Cloud Run のエンドポイント URL
- `artifact_registry_url` — Docker イメージの push 先
- `cloud_sql_connection_name` — Cloud SQL の接続名
- `storage_bucket` — Cloud Storage のバケット名


## 手動デプロイ（初回）

Cloud Build トリガー設定前に手動でデプロイする場合:

```bash
# Docker イメージのビルドと push
cd backend
docker build -t asia-northeast1-docker.pkg.dev/gjh-hack/gjh-repo/gjh-backend:latest .
docker push asia-northeast1-docker.pkg.dev/gjh-hack/gjh-repo/gjh-backend:latest

# Cloud Run へデプロイ
gcloud run deploy gjh-backend \
  --image asia-northeast1-docker.pkg.dev/gjh-hack/gjh-repo/gjh-backend:latest \
  --region asia-northeast1
```

## リソースの削除

```bash
cd terraform/environments/dev
terraform destroy
```

`yes` を入力して全リソースを削除します。

