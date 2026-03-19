# Cloud Build での自動マイグレーションが未実装

## 概要
08-infrastructure.md / 13-beyond-mvp.md (B-03) で定義されている Cloud Build パイプラインでの自動 DB マイグレーションが実現できていない。スキーマ変更時は手動で適用する必要がある。

## 試行した内容
1. `cloudbuild.yaml` に `pnpm db:push` ステップを追加
2. `availableSecrets` で Secret Manager から `DATABASE_URL` を取得
3. Cloud Build SA に `secretmanager.secretAccessor` 権限を付与

## 失敗した原因
- Secret Manager の `DATABASE_URL` は Cloud SQL Auth Proxy の Unix ソケット形式: `postgresql://app:pass@/gitalk?host=/cloudsql/gitalk-01100128:asia-northeast1:gitalk-db`
- Cloud SQL Auth Proxy の Unix ソケットパス（`/cloudsql/...`）は **Cloud Run コンテナ内でのみ**利用可能
- Cloud Build のビルドステップにはソケットマウントがないため、DB に接続できない
- `drizzle-kit push` 内部で `postgres.js` がこの URL を解析して接続しようとするが、ソケットファイルが存在しないためタイムアウト

## 現在の回避策
スキーマ変更時に手動で以下を実行:
```bash
# 1. 自分の IP を承認済みネットワークに追加
gcloud sql instances patch gitalk-db --project=gitalk-01100128 --authorized-networks=$(curl -s https://api.ipify.org)/32 --quiet

# 2. Public IP 経由でスキーマ適用
DATABASE_URL="postgresql://app:password@<PUBLIC_IP>:5432/gitalk" pnpm db:push

# 3. 承認済みネットワークをクリア
gcloud sql instances patch gitalk-db --project=gitalk-01100128 --clear-authorized-networks --quiet
```

## 解決策の候補

### 1. Cloud Build で Cloud SQL Auth Proxy をサイドカーとして起動
```yaml
- name: 'gcr.io/cloud-sql-connectors/cloud-sql-proxy:latest'
  args: ['--port=5432', 'gitalk-01100128:asia-northeast1:gitalk-db']
  # バックグラウンドで起動し、次のステップで localhost:5432 に接続
```
Cloud Build のマルチステップでサイドカーを起動する方法は公式ドキュメントに記載があるが、設定が複雑。

### 2. Cloud Build で Public IP + 承認済みネットワーク自動追加
Cloud Build ステップ内で `gcloud sql instances patch` を実行して自分の IP を追加し、マイグレーション後に削除。ただし Cloud Build の IP は固定ではないため不安定。

### 3. Cloud Run Jobs でマイグレーション実行
Cloud Run Jobs は Cloud SQL Auth Proxy が使えるため、マイグレーション用の Job を作成しデプロイ前に実行。

## 今後の対応
- [ ] 解決策 1 または 3 を検証
- [ ] 頻繁なスキーマ変更が発生する段階で自動化を実装
- [ ] それまでは手動マイグレーションで運用
