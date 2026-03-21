# 027 - ダイアログ ライトモード テキスト色修正

## 対象ファイル
- `frontend/app/conversation/_compornents/push-dialog.tsx`
- `frontend/app/conversation/_compornents/merge-dialog.tsx`

## 問題
ライトモードで入力テキスト・ラベルの色がプレースホルダーと区別できないほど薄かった。
ダークモード用の色（`text-neutral-200`, `text-neutral-300`, `text-neutral-400`）が `dark:` プレフィックスなしで適用されていたため。

## 修正内容

### push-dialog.tsx

| 要素 | 修正前 | 修正後 |
|------|--------|--------|
| input テキスト | `text-neutral-200` | `text-neutral-800 dark:text-neutral-200` |
| select テキスト | `text-neutral-200` | `text-neutral-800 dark:text-neutral-200` |
| プレースホルダー | `placeholder-neutral-500` | `placeholder-neutral-400 dark:placeholder-neutral-500` |
| 非アクティブタブ | `text-neutral-400` | `text-neutral-500 dark:text-neutral-400` |
| ラジオボタンラベル | `text-neutral-300` | `text-neutral-700 dark:text-neutral-300` |
| ブランチ選択見出し | `text-neutral-400` | `text-neutral-600 dark:text-neutral-400` |
| ブランチラベル | `text-neutral-300` | `text-neutral-700 dark:text-neutral-300` |
| キャンセルボタン | `text-neutral-400` | `text-neutral-600 dark:text-neutral-400` |
| 閉じるボタンhover | `hover:text-neutral-300` | `hover:text-neutral-700 dark:hover:text-neutral-300` |

### merge-dialog.tsx

| 要素 | 修正前 | 修正後 |
|------|--------|--------|
| Select テキスト | `text-neutral-200` | `text-neutral-800 dark:text-neutral-200` |
| マージ元ラベル | `text-neutral-400` | `text-neutral-600 dark:text-neutral-400` |
| マージ先ラベル | `text-neutral-400` | `text-neutral-600 dark:text-neutral-400` |
| 要約の粒度ラベル | `text-neutral-400` | `text-neutral-600 dark:text-neutral-400` |
| キャンセルボタン | `text-neutral-400` | `text-neutral-600 dark:text-neutral-400` |
| 閉じるボタンhover | `hover:text-neutral-300` | `hover:text-neutral-700 dark:hover:text-neutral-300` |
