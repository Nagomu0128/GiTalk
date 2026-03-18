# 014 - Cloud SQL スキーマ未適用の修正

## 日時
2026-03-19

## 問題
本番環境で会話作成時に 500 エラー。ログ: `Failed query: insert into "user"` — Cloud SQL にテーブルが存在しない。

## 原因
ローカル開発では `pnpm db:push` で Docker PostgreSQL にスキーマを適用していたが、Cloud SQL には一度もマイグレーションを実行していなかった。

## 対処
1. `gcloud sql instances patch` で一時的に自分の IP を Cloud SQL の承認済みネットワークに追加
2. `DATABASE_URL="postgresql://app:password@35.221.78.132:5432/gitalk" pnpm db:push` で全7テーブルを一括適用
3. テーブル一覧を確認（user, conversation, branch, node, repository, repository_branch, repository_node）
4. 承認済みネットワークをクリア（セキュリティ確保）

## 教訓
- Cloud Build の CI/CD パイプラインにマイグレーションステップが未実装（specs 08-infrastructure.md で定義済み）
- 手動マイグレーションは一時的な対処。本来は Cloud Build のデプロイ前ステップで `drizzle-kit migrate` を実行すべき

## スキップした項目
- Cloud Build へのマイグレーションステップ追加（将来対応）
