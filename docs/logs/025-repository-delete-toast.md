# 025: リポジトリ削除時のトースト通知追加

## 概要
リポジトリを削除した際に、shadcn (sonner) を用いたトースト通知を表示するようにした。

## 変更内容

### 1. shadcn sonner コンポーネントの導入
- `npx shadcn@latest add sonner` で sonner をインストール
- `components/ui/sonner.tsx` が生成された
- `next-themes` の `useTheme` は未使用のため、テーマを `"dark"` に固定

### 2. レイアウトに Toaster を配置
- `app/layout.tsx` に `<Toaster />` を追加し、アプリ全体でトーストが表示されるようにした

### 3. リポジトリ削除時にトーストを表示
- `app/dashboard/repositories/page.tsx` の `handleDelete` を修正
  - 削除成功時: `toast.success` でリポジトリ名を含む成功メッセージを表示
  - 削除失敗時: `toast.error` でエラーメッセージを表示
  - `handleDelete` の引数を `repoId: string` から `repo: RepositorySummary` に変更し、トーストにリポジトリ名を表示できるようにした

## エラー
- なし。ビルド成功。
