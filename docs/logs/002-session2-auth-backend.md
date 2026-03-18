# 002 - Session 2: 認証基盤（バックエンド）

## 日時
2026-03-18

## 対象タスク
- T1-1: User テーブル + infra（findByFirebaseUid, upsertByFirebaseUid）
- T1-2: 認証ミドルウェア（Firebase ID トークン検証、getAuthUser(c)、初回ログイン時 User 自動作成）

## 実施内容

### パッケージ追加
- `firebase-admin`: Firebase Admin SDK（トークン検証用）

### 作成ファイル

| ファイル | 内容 |
|---------|------|
| `infra/firebase-auth.ts` | Firebase Admin SDK 初期化、`verifyFirebaseToken()` で ID トークン検証。ResultAsync を返す |
| `infra/user.ts` | `findUserByFirebaseUid()`, `upsertUserByFirebaseUid()`（ON CONFLICT DO UPDATE で冪等処理）。ResultAsync を返す |
| `middleware/auth.ts` | `authMiddleware`（認証必須）、`optionalAuthMiddleware`（認証オプショナル）、`getAuthUser(c)`、`getOptionalAuthUser(c)` |

### アーキテクチャ判断

- `authMiddleware` 内で `upsertUserByFirebaseUid` を呼び出し、初回ログイン時に User レコードを自動作成する設計
- `ON CONFLICT DO UPDATE` で `updatedAt` のみ更新し、既存ユーザーのログイン時も冪等に処理
- `getAuthUser()` は `AuthenticatedUser` 型（`firebaseUser` + `dbUser`）を返す。ルートハンドラで `user.dbUser.id` のように DB の User ID にアクセスできる
- Firebase 初期化は `GOOGLE_APPLICATION_CREDENTIALS`（サービスアカウントキー）または `FIREBASE_PROJECT_ID`（ADC）で対応

### コーディングルール準拠
- `class` 不使用（関数ベース）
- `let`, `var`, `for`, `while` 不使用
- `neverthrow` の `ResultAsync` でエラーハンドリング
- `errorBuilder` パターンで `FirebaseAuthError`, `DBUserError` 定義

### Session 1 補完: リクエストログミドルウェア
- T0-3 の成果物「リクエストログ」が Session 1 で未実装だったため、本セッションで追加
- `middleware/request-logger.ts`: method, path, status, duration を JSON 構造化ログで出力
- `index.ts` にグローバルミドルウェアとして登録

## スキップした項目
- **Firebase Admin SDK のビルドスクリプト承認:** `pnpm approve-builds` で `@firebase/util`, `protobufjs` の承認が必要。動作に支障はないためスキップ
- **E2E 認証テスト:** Firebase プロジェクトへの接続 + ローカル PostgreSQL が必要なため未実施。Session 3（フロントエンド認証）完了後に E2E で確認予定

## 確認結果
- `tsc --noEmit`: パス
- `pnpm lint`: パス

## 次のステップ
Session 3: 認証基盤（フロントエンド）+ Firebase 設定（T0-2 + T1-3）
