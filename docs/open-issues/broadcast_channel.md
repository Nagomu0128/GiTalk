# BroadcastChannel API によるタブ間同期が未実装

## 概要
12-development-guide.md で定義されている BroadcastChannel API によるタブ間同期が未実装。同一ユーザーが複数タブで同じ会話を開いた場合にデータの不整合が発生する。

## specs の定義（12-development-guide.md）
```typescript
const channel = new BroadcastChannel("gitalk-sync");

// ノード作成後に他タブに通知
channel.postMessage({ type: "NODE_CREATED", conversationId, nodeId });

// 他タブからの通知を受信してストアを更新
channel.onmessage = (e) => {
  match(e.data.type)
    .with("NODE_CREATED", () => { /* ノードを再取得 */ })
    .with("BRANCH_SWITCHED", () => { /* ブランチ状態を更新 */ })
    .with("CONVERSATION_DELETED", () => { /* 一覧から削除 */ })
    .exhaustive();
};
```

## 現在の実装
- シングルタブでの動作のみ対応
- 複数タブで同じ会話を開いた場合、一方のタブでの変更が他方に反映されない

## 影響範囲
- タブ A でメッセージ送信 → タブ B のツリー・チャットに反映されない
- タブ A でブランチ切替 → タブ B は旧ブランチのまま
- タブ A で会話削除 → タブ B は削除済み会話を表示し続ける

## 実装方針
1. `lib/broadcast.ts` に BroadcastChannel の初期化・送受信ユーティリティを作成
2. 各操作完了時に `channel.postMessage` でイベントを送信:
   - `NODE_CREATED`: チャット送信完了時
   - `BRANCH_CREATED`: ブランチ作成時
   - `BRANCH_SWITCHED`: ブランチ切替時
   - `BRANCH_RESET`: reset 実行時
   - `MERGE_COMPLETED`: merge 完了時
   - `CONVERSATION_DELETED`: 会話削除時
   - `TITLE_UPDATED`: タイトル変更時
3. 受信側は該当する Zustand ストアを更新（refetch or 差分適用）
4. 追加のインフラコストはゼロ（ブラウザ API のみ）

## 今後の対応
- [ ] MVP 完了後または複数タブ利用のニーズが出た時点で実装
- [ ] 409 CONFLICT（楽観的ロック）発生時の自動同期とも連携
