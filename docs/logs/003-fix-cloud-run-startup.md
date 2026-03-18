# 003 - Cloud Run 起動エラー修正

## 日時
2026-03-18

## 問題
Cloud Build デプロイ後、Cloud Run のコンテナが起動に失敗。
エラー: `The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout.`

## 原因
1. **tsconfig.json に `rootDir` が未設定:** `tsc` のビルド出力が `dist/src/index.js` になっていたが、Dockerfile の CMD は `dist/index.js` を参照していたため、エントリーポイントが見つからずクラッシュ
2. **Dockerfile に `pnpm-workspace.yaml` のコピーが欠落:** esbuild ビルドスクリプト承認ファイルがコンテナ内に存在せず、`pnpm install` で問題が起きる可能性

## 修正内容

| ファイル | 修正 |
|---------|------|
| `tsconfig.json` | `rootDir: "./src"` と `include: ["src"]` を追加。ビルド出力が `dist/index.js` になるよう修正 |
| `Dockerfile` | `pnpm-workspace.yaml` と `.pnpm-approve-builds.json` のコピーを追加（ワイルドカードでオプショナル） |
| `db/client.ts` | DB接続を遅延初期化に変更。起動時に `DATABASE_URL` が未設定でも `process.exit(1)` せず、実際にDB操作が必要な時点で初期化 |

## スキップした項目
- Cloud Run ログの直接確認: gcloud CLI の文字化け問題で読み取れず、エラーメッセージから原因を推測

## 確認結果
- `tsc --noEmit`: パス
- `pnpm lint`: パス
- `tsc` ビルド出力: `dist/index.js` に正しく出力されることを確認
