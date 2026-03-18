# RepositoryNode の branch_color が未実装

## 概要
07-api-design.md で定義されている `GET /v1/repositories/:id/nodes` レスポンスの `branch_color` フィールドが未実装。リポジトリ詳細のツリー表示でブランチ色分けができない。

## specs の定義（07-api-design.md）
```json
{
  "branches": [
    {
      "repository_branch_id": "uuid",
      "name": "main",
      "nodes": [
        {
          "id": "uuid",
          "branch_color": "#3b82f6",
          ...
        }
      ]
    }
  ]
}
```

> `branch_color` はバックエンド側で `RepositoryBranch.id` をハッシュして HSL カラーを生成し、レスポンスに含める。

## specs の定義（01-data-model.md ブランチ色分けアルゴリズム）
```typescript
const getBranchColor = (branchId: string): string => {
  const hash = hashString(branchId);
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
};
```

## 現在の実装
- `routes/repositories.ts` の `GET /:id/nodes` は RepositoryNode のデータをそのまま返している
- `branch_color` フィールドは含まれていない
- フロントエンドの Conversation 側 TreeView では `node.branchId` をハッシュして色を決定しているが、RepositoryNode には `branchId` がない（代わりに `repositoryBranchId` がある）

## 影響範囲
- リポジトリ詳細のツリービュー（open-issues/repository_tree_view.md）実装時にブランチ色分けができない
- ツリービュー自体が未実装のため、現時点での実害はなし

## 実装方針
1. `routes/repositories.ts` の `GET /:id/nodes` でレスポンスを組み立てる際に、`repositoryBranchId` をハッシュして `branch_color` を生成
2. Conversation 側と同じ HSL ハッシュアルゴリズムを `shared/` に共通ユーティリティとして抽出

## 今後の対応
- [ ] `shared/color.ts` に `getBranchColor(id: string): string` を作成
- [ ] `routes/repositories.ts` のノードレスポンスに `branch_color` フィールドを追加
- [ ] open-issues/repository_tree_view.md のツリービュー実装と合わせて対応
