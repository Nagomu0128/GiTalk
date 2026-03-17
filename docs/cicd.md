# CI/CD パイプライン仕様書

GitHub Actionsで2本のパイプラインを構成

---

### トリガー

- CI:PR作成
- CD:`main`にマージ

### ディレクトリ構成

```
.github/
  workflows/
    infra.yml    # Terraform plan/apply
    app.yml      # App lint/build/test/deploy
```

## 1. Infra パイプライン (`infra.yml`)

Terraform による GCP インフラ管理。

### トリガー

```yaml
on:
  pull_request:
    paths:
      - "terraform/**"
  push:
    branches: [main]
    paths:
      - "terraform/**"
```

### フロー

| ステージ                        | PR 時                 | main push 時 |
| ------------------------------- | --------------------- | ------------ |
| `terraform fmt -check`          | ○                     | ○            |
| `terraform init`                | ○                     | ○            |
| `terraform validate`            | ○                     | ○            |
| `terraform plan`                | ○ (PR コメントに出力) | ○            |
| `terraform apply -auto-approve` | ×                     | ○            |

### 認証

- **Workload Identity Federation** を使う（サービスアカウントキーの JSON は避ける）
- `google-github-actions/auth@v2` + `google-github-actions/setup-gcloud@v2`
- 必要な IAM ロール: `roles/editor` または必要最小限のリソース別ロール

### GitHub Secrets / Variables

| 名前                      | 用途                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `GCP_PROJECT_ID`          | `gjh-hack`                                                                                                         |
| `GCP_WIF_PROVIDER`        | Workload Identity プロバイダー (例: `projects/123/locations/global/workloadIdentityPools/github/providers/github`) |
| `GCP_WIF_SERVICE_ACCOUNT` | Terraform 用サービスアカウント                                                                                     |
| `TF_VAR_db_password`      | Cloud SQL パスワード (sensitive)                                                                                   |
| `TF_VAR_github_owner`     | GitHub オーナー                                                                                                    |
| `TF_VAR_github_repo`      | GitHub リポジトリ名                                                                                                |

### ポイント

- `terraform/environments/dev/` を `working-directory` に指定する
- tfstate はリモートバックエンド（GCS）に移行すること（`main.tf` の TODO 参照）。ローカル state のまま CI で回すと壊れる
- PR 時に `terraform plan` の結果をコメントに貼ると差分レビューしやすい → `actions/github-script` や `terraform-plan` アクション活用
- `terraform fmt -check` が失敗したら早期終了させる

---

## 2. App パイプライン (`app.yml`)

アプリケーションのビルド・テスト・デプロイ。

### トリガー

```yaml
on:
  pull_request:
    paths:
      - "frontend/**"
      - "backend/**"
  push:
    branches: [main]
    paths:
      - "frontend/**"
      - "backend/**"
```

### フロー

```
PR 時:     lint → build → test
main 時:   lint → build → test → docker push → deploy (Cloud Run)
```

### Frontend ジョブ

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: pnpm/action-setup@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 22
      cache: pnpm
      cache-dependency-path: frontend/pnpm-lock.yaml
  - run: pnpm install --frozen-lockfile
    working-directory: frontend
  - run: pnpm lint
    working-directory: frontend
  - run: pnpm build
    working-directory: frontend
```

### Backend ジョブ

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: pnpm/action-setup@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 22
      cache: pnpm
      cache-dependency-path: backend/pnpm-lock.yaml
  - run: pnpm install --frozen-lockfile
    working-directory: backend
  - run: pnpm build
    working-directory: backend
```

### Deploy ジョブ（main push 時のみ）

既存の Cloud Build トリガー（Terraform で管理済み）と**役割が重複する**ので、どちらか一方を選ぶ:

| 方式                             | メリット                                                     | デメリット                                                      |
| -------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- |
| **A: Cloud Build に任せる**      | Terraform で一元管理。GitHub Actions は lint/build/test だけ | GitHub 上でデプロイ状況が見えにくい                             |
| **B: GitHub Actions でデプロイ** | PR ステータスで完結。environment + approval が使える         | Cloud Build モジュールが不要になる。gcloud コマンドの管理が必要 |

#### 方式 B の場合の deploy ステップ

```yaml
deploy:
  needs: [frontend, backend]
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  environment: production
  steps:
    - uses: actions/checkout@v4
    - uses: google-github-actions/auth@v2
      with:
        workload_identity_provider: ${{ secrets.GCP_WIF_PROVIDER }}
        service_account: ${{ secrets.GCP_WIF_SERVICE_ACCOUNT }}
    - uses: google-github-actions/setup-gcloud@v2
    - name: Build and push
      run: |
        gcloud builds submit backend/ \
          --tag $REGION-docker.pkg.dev/$PROJECT_ID/gjh-repo/gjh-backend:${{ github.sha }}
    - name: Deploy to Cloud Run
      run: |
        gcloud run deploy gjh-backend \
          --image $REGION-docker.pkg.dev/$PROJECT_ID/gjh-repo/gjh-backend:${{ github.sha }} \
          --region asia-northeast1
```

---

## Workload Identity Federation セットアップ

GitHub Actions から GCP にキーレス認証するための前提作業:

```bash
# 1. Workload Identity Pool 作成
gcloud iam workload-identity-pools create "github" \
  --location="global" \
  --display-name="GitHub Actions"

# 2. OIDC Provider 作成
gcloud iam workload-identity-pools providers create-oidc "github" \
  --location="global" \
  --workload-identity-pool="github" \
  --display-name="GitHub" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# 3. サービスアカウントに impersonation 許可
gcloud iam service-accounts add-iam-policy-binding SA_EMAIL \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/OWNER/REPO"
```

これを Terraform で管理するなら `google_iam_workload_identity_pool` リソースを追加する。

---

## ディレクトリ構成

```
.github/
  workflows/
    infra.yml    # Terraform plan/apply
    app.yml      # App lint/build/test/deploy
```

> **注意**: 現在 `.github/workflow/action.yml`（単数形）が空ファイルで存在する。GitHub Actions は `.github/workflows/`（複数形）を認識するので、ディレクトリ名を修正すること。
