# 026: 会話ページ UI 改善

## 概要

会話ページの3箇所のUI改善を実施。

## 変更内容

### 1. ブランチ選択セレクトをshadcn化
- **ファイル**: `frontend/app/conversation/_compornents/branch-selector.tsx`
- ネイティブ `<select>` を shadcn `Select` (`@base-ui/react`) に置換
- `onValueChange` の `null` ケースをガード

### 2. マージダイアログのマージ元セレクトをshadcn化
- **ファイル**: `frontend/app/conversation/_compornents/merge-dialog.tsx`
- マージ元ブランチ選択のネイティブ `<select>` を shadcn `Select` に置換

### 3. リポジトリ保存成功時のトーストアラート
- **ファイル**: `frontend/app/conversation/_compornents/push-dialog.tsx`
- `useToastStore`（レンダリング未実装のカスタムstore）を `sonner` の `toast` に切り替え
- 成功時: `toast.success('リポジトリに保存しました')`
- エラー時: `toast.error(...)` で表示

### 4. 比較モーダルのブランチ選択セレクトをshadcn化
- **ファイル**: `frontend/app/conversation/_compornents/diff-header.tsx`
  - ヘッダー内のブランチA/B選択（2箇所）
- **ファイル**: `frontend/app/conversation/_compornents/diff-view.tsx`
  - 初期状態の比較元/比較先ブランチ選択（2箇所）

## 追加コンポーネント
- `npx shadcn@latest add select` で `components/ui/select.tsx` を追加

## ビルド確認
- `next build` 成功
