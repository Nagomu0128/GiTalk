# 026 - Repository Detail Page リファクタリング

## 実施内容

### 1. 保存ボタンのスタイル統一
- `conversation-header.tsx` の保存ボタンを「比較」「統合」ボタンと同じスタイル（`rounded-lg`, `px-2.5`, `text-xs`, アイコン+テキスト）に変更

### 2. SidebarFooter 共通コンポーネント抽出
- `components/layout/sidebar-footer.tsx` を新規作成
- テーマ切替 + ユーザー情報 + ログアウトを共通化
- `collapsed` prop（デフォルト `false`）で折りたたみ対応
- `app-sidebar.tsx` を `SidebarFooter` を使うように更新

### 3. Repository Detail Page 分割
`app/repository/[id]/page.tsx`（386行）を以下に分割:

| ファイル | 責務 |
|---------|------|
| `_compornents/types.ts` | 型定義（Repository, RepoNode, RepoBranch） |
| `_compornents/repository-header.tsx` | ヘッダー |
| `_compornents/branch-list-panel.tsx` | ブランチ一覧サイドバー |
| `_compornents/conversation-panel.tsx` | 会話表示パネル |
| `_compornents/clone-dialog.tsx` | クローンダイアログ（状態を内包） |
| `_compornents/use-repository-detail.ts` | データ取得・状態管理カスタムフック |
| `page.tsx` | レイアウト組み立てのみ（約75行） |

## エラー
なし。TypeScript 型チェック・lint ともにパス。
