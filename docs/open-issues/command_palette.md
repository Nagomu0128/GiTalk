# CommandPalette (Ctrl+K) が未実装

## 概要
05-ui-ux.md で定義されているコマンドパレット機能が未実装。パワーユーザー向けの操作効率化機能。

## specs の定義（05-ui-ux.md）
- `Ctrl+K` で起動するコマンドパレット
- 全操作をテキスト検索で実行可能
- エンジニアユーザーが素早く操作するため

## specs の定義（12-development-guide.md）
```
frontend/components/
└── ui/
    └── command-palette.tsx
```

## 現在の実装
- 未実装。全 Git 操作は BranchSelector（ドロップダウン）と NodeContextMenu（右クリック）で提供されている

## 影響範囲
- パワーユーザーの操作効率が低下する
- ただし全操作は GUI で実行可能なため、機能的な不足はない

## 実装方針
- `Ctrl+K` のキーバインドでモーダルを表示
- テキスト入力でコマンドをファジー検索
- 利用可能なコマンド例:
  - 「新しい分岐を作成」→ branch
  - 「ブランチを切り替え」→ switch（ブランチ一覧を表示）
  - 「ここまで戻す」→ reset
  - 「会話を統合」→ merge dialog を開く
  - 「ブランチを比較」→ diff view を開く
  - 「リポジトリに保存」→ push dialog を開く
- cmdk（https://cmdk.paco.me/）などのライブラリの採用を検討

## 今後の対応
- [ ] Session 9 以降または MVP 完了後に実装
- [ ] 対応するコマンド一覧を確定
- [ ] キーボードショートカット一覧も合わせて定義
