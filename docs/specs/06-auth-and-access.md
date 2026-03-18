# 06 - 認証・アクセス制御

## 概要

Firebase Authentication を使用したユーザー認証と、リポジトリの公開範囲に基づくアクセス制御。

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
- `firebase_uid` で Firebase と紐付け
- `display_name` は Firebase のプロフィールから初期値を取得

### セッション管理

- JWT ベースのステートレス認証
- トークンの有効期限は Firebase のデフォルト（1時間）
- フロントエンドで自動リフレッシュ

## アクセス制御

### Conversation（会話）

- **所有者のみ操作可能:** Conversation は作成者だけがアクセス・編集できる
- 将来の共同編集で権限モデルを拡張する余地を持たせる

### Repository（リポジトリ）

| 公開範囲 | 読み取り | 書き込み（push） | 設定変更 |
|---------|---------|----------------|---------|
| private | 所有者のみ | 所有者のみ | 所有者のみ |
| public | 全ユーザー | 所有者のみ | 所有者のみ |
| limited_access | 所有者 + 招待者 | 所有者のみ | 所有者のみ |

### API レベルの認可

バックエンドの各エンドポイントで以下を検証:

1. **認証チェック:** トークンが有効か
2. **リソース所有チェック:** リクエストされたリソースの owner_id が自分か
3. **公開範囲チェック:** Repository の visibility に基づくアクセス許可

```typescript
// Hono middleware 例
const authMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const decoded = await verifyFirebaseToken(token);
  c.set("userId", decoded.uid);
  await next();
});
```

## limited_access の招待機能（MVP後）

- 所有者がユーザーを招待（メールアドレス or ユーザーID）
- 招待テーブル: `RepositoryAccess(repository_id, user_id, granted_at)`
- 招待されたユーザーは読み取り権限を持つ
