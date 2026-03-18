# 005 - E2E 認証テスト検証

## 日時
2026-03-18

## 目的
Session 1〜3 の成果物がmainブランチ上で統合された状態で、E2E 認証フローが正常に動作することを検証する。

## テスト環境
- PostgreSQL: Docker コンテナ（postgres:15、ローカル 5432）
- バックエンド: `pnpm dev`（localhost:8080）
- フロントエンド: `pnpm dev`（localhost:3000）
- Firebase プロジェクト: gitalk-01100128（Google プロバイダ有効）

## テスト手順
1. PostgreSQL コンテナ起動確認
2. バックエンド起動 → `GET /health` で `{"status":"ok"}` を確認
3. 一時テストエンドポイント `GET /v1/auth/me`（authMiddleware 適用）を追加
4. フロントエンド起動 → ダッシュボードに一時テストボタンを追加
5. ブラウザで http://localhost:3000 にアクセス
6. Google ログイン実行
7. ダッシュボードで「認証テスト」ボタンをクリック
8. バックエンドからのレスポンスを確認

## テスト結果: ✅ 成功

レスポンス:
```json
{
  "firebaseUid": "I4CZXM3YtgNYnLsMARgbMenBPc43",
  "displayName": "Nagomu",
  "dbUserId": "6a3b51c6-0fce-418b-92ee-9e535f0862e1"
}
```

確認できた動作:
- Firebase Google ログイン → ID トークン発行
- フロントエンドから `Authorization: Bearer <token>` でバックエンド呼び出し
- バックエンドで Firebase Admin SDK によるトークン検証
- 初回ログイン時の User レコード自動作成（upsert）
- DB から User 情報を取得してレスポンス返却

## 発生した問題と対処
- **ポート競合（EADDRINUSE）:** 前回のバックエンドプロセスが残っていた。`taskkill` で強制終了して再起動
- 一時テストコードは検証完了後に削除済み

## スキップした項目
- 未認証リクエスト時の 401 レスポンス確認（目視で AuthProvider のリダイレクトが動作していることは確認済み）
