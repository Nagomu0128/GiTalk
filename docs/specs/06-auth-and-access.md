# 06 - 認証・アクセス制御・セキュリティ

## 概要

Firebase Authentication を使用したユーザー認証、リポジトリの公開範囲に基づくアクセス制御、およびアプリケーション全体のセキュリティ対策。

## 認証

### Firebase Authentication

**対応するサインイン方法（MVP）:**
- Google アカウント
- メール/パスワード

**認証フロー:**
1. フロントエンドで Firebase Auth SDK を使ってサインイン
2. Firebase が ID トークン（JWT）を発行
3. フロントエンドが API リクエストに `Authorization: Bearer <token>` ヘッダーを付与
4. バックエンド（Hono）が Firebase Admin SDK でトークンを検証
5. トークンから `firebase_uid` を取得し、内部の User テーブルと照合

```
Client → Firebase Auth → ID Token
Client → Hono API (Bearer Token) → Firebase Admin SDK (verify) → User lookup
```

### ユーザー登録

- 初回サインイン時に User レコードを自動作成
- `firebase_uid` に UNIQUE 制約があるため、`INSERT ... ON CONFLICT (firebase_uid) DO NOTHING` で冪等に処理
- `display_name` は Firebase のプロフィールから初期値を取得
- Firebase のプロフィール変更は User テーブルに自動同期しない（ユーザーがアプリ内で手動変更）

### セッション管理

- JWT ベースのステートレス認証
- トークンの有効期限は Firebase のデフォルト（1時間）
- フロントエンドで `onIdTokenChanged` を使って自動リフレッシュ
- AuthContext で認証状態を管理し、未認証時は `/login` にリダイレクト

## アクセス制御

### Conversation（会話）

- **所有者のみ操作可能:** Conversation は作成者だけがアクセス・編集できる
- 他人の Conversation にアクセスした場合は `404 NOT_FOUND`（存在を隠す）
- 将来の共同編集で権限モデルを拡張する余地を持たせる

### Repository（リポジトリ）

MVP では `private` と `public` のみサポート。`limited_access` は将来機能。

| 公開範囲 | 読み取り | 書き込み（push） | 設定変更 |
|---------|---------|----------------|---------|
| private | 所有者のみ | 所有者のみ | 所有者のみ |
| public | 全ユーザー（未認証含む） | 所有者のみ | 所有者のみ |

- 未認証ユーザーが private リポジトリにアクセスした場合は `404 NOT_FOUND`
- 認証済みユーザーが他人の private リポジトリにアクセスした場合も `404 NOT_FOUND`

### API レベルの認可

バックエンドの各エンドポイントで以下を検証:

1. **認証チェック:** トークンが有効か
2. **リソース所有チェック:** リクエストされたリソースの owner_id が自分か
3. **公開範囲チェック:** Repository の visibility に基づくアクセス許可

```typescript
// Hono middleware: 認証
const authMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);

  const decoded = await verifyFirebaseToken(token);
  c.set("userId", decoded.uid);
  await next();
});

// Hono middleware: 認証が任意（public リポジトリ用）
const optionalAuthMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (token) {
    try {
      const decoded = await verifyFirebaseToken(token);
      c.set("userId", decoded.uid);
    } catch {
      // トークンが無効でも続行（未認証として扱う）
    }
  }
  await next();
});
```

## セキュリティ対策

### CORS

```typescript
// Hono CORS 設定
app.use('*', cors({
  origin: [
    'http://localhost:3000',                    // ローカル開発
    'https://<firebase-app-hosting-domain>',    // 本番（Firebase App Hosting のドメイン）
  ],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));
```

### 入力バリデーション

- 全リクエストボディを Zod でバリデーション（07-api-design.md の入力バリデーションルール参照）
- UUID パラメータは UUID v4 形式を検証
- SQL インジェクション対策: ORM / クエリビルダのパラメータバインディングを使用（生 SQL は禁止）

### XSS 対策

- AI の応答（`ai_response`）を Markdown レンダリングする際は、DOMPurify でサニタイズしてから表示
- `user_message` も表示時にサニタイズ
- React のデフォルトのエスケープ処理に加え、`dangerouslySetInnerHTML` は使用しない

### レート制限

| エンドポイント | 制限 | 単位 |
|--------------|------|------|
| POST /conversations/:id/chat | 20 リクエスト | 1分あたり（ユーザー単位） |
| POST /conversations/:id/merge | 10 リクエスト | 1分あたり（ユーザー単位） |
| その他の POST/PATCH/DELETE | 60 リクエスト | 1分あたり（ユーザー単位） |
| GET エンドポイント | 120 リクエスト | 1分あたり（ユーザー単位） |

超過時は `429 RATE_LIMITED` を返す。

### その他

- HTTPS のみ（Cloud Run はデフォルトで HTTPS を強制）
- Firebase ID トークンの検証は毎リクエスト実施（キャッシュしない）
- ログには個人情報（メッセージ内容等）を含めない。ログ対象はリクエストメタデータ（method, path, status, duration）のみ

## limited_access の招待機能（MVP後）

- 所有者がユーザーを招待（メールアドレス or ユーザーID）
- 招待テーブル: `RepositoryAccess(repository_id, user_id, granted_at)`
- 招待されたユーザーは読み取り権限を持つ
- `visibility_type` ENUM に `limited_access` を追加する ALTER TYPE マイグレーションが必要
