# tree-store.ts が未分離

## 概要
12-development-guide.md で定義されている `stores/tree-store.ts`（React Flow ノード・エッジ・選択状態）が未作成。現在は `conversation-store` + `tree-view.tsx` 内の `useState` で管理している。

## specs の定義（12-development-guide.md）
```
frontend/stores/
├── conversation-store.ts  # 会話・ブランチ・ノード状態
├── chat-store.ts          # チャットメッセージ・ストリーミング状態
├── tree-store.ts          # React Flow ノード・エッジ・選択状態
└── auth-store.ts          # 認証状態
```

## 現在の実装
- `tree-view.tsx` 内で `useState<Node[]>` と `useState<Edge[]>` で React Flow の状態を管理
- ノード選択状態は React Flow の内部状態に依存
- 他コンポーネントから React Flow の状態にアクセスする手段がない

## 影響範囲
- 現時点では `tree-view.tsx` が単独で完結しているため問題なし
- Session 8（Git 操作 UI 統合）で右クリックメニューやブランチ操作パネルからツリー状態にアクセスする際に、`useState` では不十分になる可能性
- ツリー↔チャット連携（ノードクリック → チャット切替）の双方向同期で状態共有が必要になる可能性

## 修正方法
```typescript
// stores/tree-store.ts
import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';

type TreeState = {
  flowNodes: ReadonlyArray<Node>;
  flowEdges: ReadonlyArray<Edge>;
  selectedNodeId: string | null;
  setFlowNodes: (nodes: ReadonlyArray<Node>) => void;
  setFlowEdges: (edges: ReadonlyArray<Edge>) => void;
  setSelectedNodeId: (id: string | null) => void;
};
```

## 今後の対応
- [ ] Session 8（Git 操作 UI 統合）で他コンポーネントからのツリー状態アクセスが必要になった時点で分離
- [ ] BroadcastChannel API でのタブ間同期にもツリー状態が含まれる場合は分離が必須
