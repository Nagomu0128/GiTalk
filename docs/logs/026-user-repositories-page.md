# 026 - 他ユーザーのリポジトリ閲覧機能

## 概要

URLを `/dashboard/repositories` から `/dashboard/repositories/[userId]` に変更し、他ユーザーのpublicリポジトリを閲覧できるようにした。ユーザー検索バーも追加。

## 変更内容

### Backend

- **`backend/src/infra/user.ts`**: `findUserById`、`searchUsersByName` を追加
- **`backend/src/infra/repository.ts`**: `listPublicRepositoriesByOwner` を追加（publicリポジトリのみ返却）
- **`backend/src/routes/users.ts`** (新規): 3つのエンドポイント
  - `GET /v1/users/me` — ログインユーザーのDB情報
  - `GET /v1/users/search?q=...` — ユーザー名検索
  - `GET /v1/users/:userId/repositories` — ユーザーのリポジトリ一覧（自分=全部、他人=publicのみ）
- **`backend/src/index.ts`**: `usersRouter` を登録

### Frontend

- **`frontend/app/dashboard/repositories/page.tsx`**: `/dashboard/repositories/[myUserId]` へリダイレクト
- **`frontend/app/dashboard/repositories/[userId]/page.tsx`** (新規): 動的ルートページ
  - 自分: 全リポジトリ + 削除 + visibility filter
  - 他人: publicのみ + 削除不可
- **`_components/repository-card.tsx`**: リポジトリカード（共通コンポーネント）
- **`_components/repository-filter-bar.tsx`**: フィルター＆ソートバー
- **`_components/delete-confirm-dialog.tsx`**: 削除確認ダイアログ
- **`_components/user-search-bar.tsx`**: ユーザー名検索バー（debounce付き）

## エラー

なし。TypeScriptチェック通過。
