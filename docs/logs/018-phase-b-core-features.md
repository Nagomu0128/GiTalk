# 018 - Phase B: コア機能の拡充

## 日時
2026-03-19

## 対象タスク
- B-04: cherry-pick
- B-05: clone
- B-07: リポジトリツリービュー（スキップ）
- B-15: tree-store 分離

## 実施内容

### B-04: cherry-pick

**バックエンド:**
- `service/git-operations.service.ts` に `cherryPickNode` を追加
  - source ノードの user_message, ai_response, model, token_count をコピー
  - metadata に `{ cherry_picked_from: sourceNodeId }` を記録
  - target ブランチの head を楽観的ロックで更新
- `routes/git-operations.ts` に `POST /cherry-pick` エンドポイントを追加

**フロントエンド:**
- `NodeContextMenu` に「📋 このノードを取り込む」メニューを追加
- `isOtherBranch` prop で別ブランチのノードの場合のみ表示

### B-05: clone

**バックエンド:**
- `service/repository.service.ts` に `cloneRepository` を追加
  - Repository + RepositoryBranch + RepositoryNode を取得
  - 新 Conversation 作成（title = "元タイトル (clone)"）
  - RepositoryNode → Node にコピー（parent_id のマッピング）
  - 各 RepositoryBranch → Branch にコピー
- `routes/repositories.ts` に `POST /:id/clone` エンドポイントを追加

**フロントエンド:**
- リポジトリ詳細ページに「📋 コピーして使う」ボタンを追加
- clone 完了後、新しい会話画面に遷移

### B-15: tree-store 分離

- `stores/tree-store.ts` を新規作成（Zustand）
- flowNodes, flowEdges, selectedNodeId の状態管理
- tree-view.tsx の useState → tree-store への移行は後続で実施

## スキップした項目
- **B-07 リポジトリツリービュー:** React Flow でのリポジトリノード表示は後続で実装。現在の会話表示タブで閲覧は可能
- **cherry-pick の会話画面 UI 統合:** NodeContextMenu に追加したが、conversation page の handleCherryPick ハンドラの接続は後続で実施
- **tree-view.tsx の tree-store 移行:** store は作成したが、既存の useState からの移行は B-12（ツリー折りたたみ）実装時に合わせて行う

## 確認結果
- `tsc --noEmit`: パス（BE/FE 両方）
- `pnpm lint`: パス（BE/FE 両方、warning のみ）
