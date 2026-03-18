# リポジトリ詳細のツリービュー（React Flow）が未実装

## 概要
11-wireframes.md セクション7 で定義されているリポジトリ詳細画面の閲覧専用ツリービューが未実装。現在は MessageBubble による会話表示のみ。

## specs の定義（11-wireframes.md セクション7）
- React Flow でツリー構造を閲覧専用表示
- ノードクリックで右パネルに会話内容を表示
- Conversation の TreeView と同等の表示（ただし編集不可）

## specs の定義（10-task-dependencies.md T7-5）
> リポジトリ詳細 UI: メタ情報、ブランチ一覧タブ、閲覧専用ツリービュー（RepositoryNode 表示、ノードクリックで内容表示）、設定タブ

## 現在の実装
- `app/repository/[id]/page.tsx` に「ブランチ一覧」タブと「会話表示」タブを実装
- 「会話表示」タブはブランチ選択 → MessageBubble でノードを時系列表示
- React Flow によるツリー構造の可視化はなし

## 影響範囲
- ツリー構造（分岐・マージ）の視覚的な把握ができない
- Conversation 画面のツリービューと比較して体験が劣る
- ただし会話内容の閲覧自体は可能

## 実装方針
1. `components/tree/tree-view.tsx` の既存 TreeView を流用
2. RepositoryNode のデータ構造（`parentRepositoryNodeId`）を React Flow のノード・エッジに変換
3. `nodesConnectable={false}`, `nodesDraggable={false}` で閲覧専用
4. ノードクリック時に右パネルに会話内容を表示（左右分割レイアウト）

## 今後の対応
- [ ] RepositoryNode → React Flow ノード変換ユーティリティを作成
- [ ] リポジトリ詳細ページにツリービュータブを追加
- [ ] ノードクリック → 会話内容パネル表示の実装
