---
name: coding-rules
description: Coding conventions and rules for this project. Enforces functional programming style, neverthrow error handling, ts-pattern matching, layered architecture with Hono.js best practices, and RESTful API design. Always follow when writing code.
user-invocable: false
disable-model-invocation: false
allowed-tools: Read, Grep, Glob
---

# Coding Rules
* Follow functional programming style coding.
* Never use `class`, `for`, `while`, `let`, and `var`.
* Avoid using `as` as long as possible.
* Use neverthrow for throwing error, such as `Result<T, E>`, `ok(value)`, `err(error)` and so on.
* Avoid using `switch` or nested if. Instead, use ts-pattern.
* Use an utility function `errorBuilder()` in `backend/src/shared/error.ts` for defining error object. Usage:
```typescript
import { errorBuilder, InferError } from "../shared/error";

// 1. Define a simple error
// Definition:
export const FooError = errorBuilder("FooError");
export type FooError = InferError<typeof FooError>;

// Usage:
const error = FooError("Some error messages");
// or you can handle unknown error
ResultAsync.fromPromise(promise, (e: unknown) => FooError.handle(e));
// (you should pass function directly if possible!)
ResultAsync.fromPromise(promise, FooError.handle);
// You can determine error type with ts-pattern even in runtime
match(error)
  .with(FooError.is, (e) => 'handle error here...')
  .exhaustive();

// 2. Define an error with extra value using zod
import z from "zod";

// Definition:
export const DBUserNotFoundError = errorBuilder(
  "DBUserNotFoundError",
  z.union([z.object({ id: z.string() }), z.object({ uid: z.string() })])
);
export type DBUserNotFoundError = InferError<typeof DBUserNotFoundError>;

// Usage:
const error = DBUserNotFoundError("User not found", { extra: { uid } });

// 3. Define an error with extra value without zod
export const InvalidUserError = errorBuilder<
  "InvalidUserError",
  FieldErrors<typeof User>
>("InvalidUserError");
export type InvalidUserError = InferError<typeof InvalidUserError>;
```

* Use appLogger in `backend/src/shared/logger.ts` for logging. Usage:
```typescript
import { appLogger } from "../shared/logger";

const logger = appLogger("fetchDBUserByUid");
logger.debug('foo');
logger.info('foo');
logger.warn('foo');
logger.error('foo');

// You can pass object
logger.info('User created', { user });
// This is a nice way to use logger with neverthrow
ResultAsync(promise, FooError.handle)
  // ...
  .orTee(logger.error)
```

# Backend Directory Structure
* Architecture follows a layered design aligned with Hono.js best practices.
* Be careful to avoid anemic domain models — domain objects should contain business logic, not just data.
* The domain layer must not depend on external layers (infra, routes, etc.).
* Do not leak DB schemas or DB-specific types into the route handlers.
* The service layer must not be a mere wrapper around the infra layer — it should orchestrate domain logic and express use cases.
```
/
├─ src
│  ├─ middleware  // Hono middleware (auth, error handling, etc.)
│  │  ├─ auth.ts           // Firebase token verification, getAuthUser(c)
│  │  └─ error-handler.ts  // Global error handler (Result → HTTP response with ts-pattern)
│  ├─ routes     // API routes + handlers (Hono.js)
│  │  ├─ conversations.route.ts // OpenAPI spec definition for /v1/conversations
│  │  ├─ conversations.ts       // Hono.js route handler for /v1/conversations
│  │  └─ ...
│  ├─ service    // Application services layer (use cases, orchestration)
│  ├─ domain     // Domain layer (domain models, domain services, business logic)
│  ├─ infra      // Infrastructure layer (database queries, external API clients)
│  ├─ db         // Database settings, Drizzle schema, migrations
│  ├─ shared     // Shared utilities (errorBuilder, logger, types, constants)
│  └─ index.ts   // Entrypoint
└─ test
   └─ unit       // Unit tests
```

## Layer responsibilities

### middleware/
* Hono の `app.use()` で適用するミドルウェア
* 認証: Firebase ID トークン検証。`getAuthUser(c)` でルートハンドラから認証済みユーザーを取得
* エラーハンドリング: ルートハンドラが返す `Result` 型を ts-pattern でマッチし、適切な HTTP レスポンスに変換

### routes/
* `*.route.ts`: @hono/zod-openapi による OpenAPI スキーマ定義と Zod バリデーション
* `*.ts`: ルートハンドラ。service を呼び出し、Result を受け取り、レスポンスを返す
* ルートハンドラ内で ts-pattern を使い、service からの Result<T, E> を HTTP レスポンスにマッピング

```typescript
// routes/conversations.ts — ルートハンドラの例
import { match } from "ts-pattern";
import { getAuthUser } from "../middleware/auth";

app.get("/v1/conversations", async (c) => {
  const user = getAuthUser(c);
  const result = await conversationService.listByOwner(user.id);

  return match(result)
    .with({ _tag: "Ok" }, ({ value }) => c.json({ data: value }))
    .with({ _tag: "Err" }, ({ error }) =>
      match(error)
        .with(DBError.is, () => c.json({ error: { code: "INTERNAL_ERROR", message: "Database error" } }, 500))
        .exhaustive()
    )
    .exhaustive();
});
```

### service/
* ユースケースを表現。domain と infra を組み合わせてビジネスロジックを実行
* ResultAsync を返す

### domain/
* ドメインモデル、ドメインサービス、ビジネスルール
* 外部レイヤーに依存しない

### infra/
* DB クエリ（Drizzle ORM）、外部 API クライアント（Gemini / Firebase Admin）
* ResultAsync を返す

# REST API Structure
* Every route should start with /v1
* Follow RESTful. For instance,
  * GET /v1/conversations
  * POST /v1/conversations
  * GET /v1/conversations/:conversationId/branches
  * POST /v1/conversations/:conversationId/chat
  * POST /v1/conversations/:conversationId/merge
  * POST /v1/repositories/:repositoryId/push
# Other information
* You can get session user by `getAuthUser(c)` (c is Context in Hono.js). Defined in `src/middleware/auth.ts`, used in `src/routes/*.ts`
