# 024 - リポジトリ一覧レイアウト改善 + オーナー表示

## 概要
`/dashboard/repositories` のリポジトリカードレイアウトを仕様のワイヤーフレーム（`docs/specs/11-wireframes.md` セクション5）に合わせて改善。リポジトリ作成者（オーナー）の表示も追加。

## 変更ファイル

### バックエンド
- `backend/src/infra/repository.ts`
  - `users` テーブルを import
  - `RepositoryWithOwner` 型を追加（`RepositoryRecord` + `owner` オブジェクト）
  - `listRepositoriesByOwner()` を `db.select().innerJoin()` に変更し、`owner.displayName` / `owner.avatarUrl` を返すように修正

### フロントエンド
- `frontend/app/dashboard/repositories/page.tsx`
  - `RepositorySummary` 型に `owner` フィールドを追加
  - カード3行目にオーナーアバター + 表示名を追加

## カードレイアウト（3行構成）
- **1行目**: Package アイコン + リポジトリ名 + visibility バッジ（Lock/Globe アイコン付き）
- **2行目**: 説明文（なければ「説明なし」をグレー表示）
- **3行目**: オーナーアバター + 表示名 · 更新日時（相対表示）

## フィルターバー追加
- **公開範囲フィルタ**: すべて / private / public のセグメントボタン
- **ソート切替**: 更新日時 / 名前のトグルボタン
- `useMemo` でフィルタ・ソート済みリストを派生（フロントエンドのみ、API変更なし）
- フィルタ結果0件時のメッセージ表示
- リポジトリが0件の場合はフィルターバー非表示

## エラー・問題
- なし（バックエンド・フロントエンドともに型チェック通過）
