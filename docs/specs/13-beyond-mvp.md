# 13 - Beyond MVP 要件定義

## 概要

MVP 完了後に実装すべき機能・改善を優先度順に定義する。
Open Issues（技術的負債）と新機能を統合し、現在のアーキテクチャ・コーディングルールに沿った実装方針を示す。

## 優先度の定義

| 優先度 | 意味 |
|--------|------|
| P0 | 即時対応。MVP の品質に直接影響する技術的負債 |
| P1 | 短期。ユーザー体験に大きく影響する機能 |
| P2 | 中期。差別化に寄与する機能 |
| P3 | 長期。スケール時に必要になる機能 |

---

## P0: 技術的負債の解消

### B-01: specs ドキュメントの実装差分を反映

**関連:** Session 5, 13, 15 の specs 差分

現在の実装と specs が乖離している箇所を更新する。

| ドキュメント | 更新内容 |
|-------------|---------|
| `04-ai-integration.md` | Vertex AI → Google AI SDK (`@google/generative-ai`)、モデル名 `gemini-2.5-flash`、`GEMINI_API_KEY` 環境変数 |
| `07-api-design.md` | デフォルトモデルを `gemini-2.5-flash` に更新 |
| `08-infrastructure.md` | `GEMINI_API_KEY` を Secret Manager 管理の環境変数に追加。Cloud SQL Unix ソケット URL の注意事項追記 |
| `12-development-guide.md` | `next.config.ts` rewrites → Route Handler プロキシに変更。`.env` に `GEMINI_API_KEY` 追加。ADC → API キーベースに変更 |

**実装:**
- ドキュメント修正のみ。コード変更なし

### B-02: merge 要約ノードの token_count 修正

**関連:** `docs/open-issues/merge_token_count.md`

**現状:** summary ノードの `token_count` が常に 0

**実装:**

```typescript
// infra/gemini.ts に追加
export const generateContentWithMetadata = (
  contents: ReadonlyArray<Content>,
  model?: string,
): ResultAsync<{ text: string; tokenCount: number }, GeminiError> =>
  ResultAsync.fromPromise(
    (async () => {
      const client = getClient();
      const resolvedModel = model ?? getDefaultModel();
      const generativeModel = client.getGenerativeModel({ model: resolvedModel });
      const result = await generativeModel.generateContent({
        contents: contents as Content[],
      });
      const response = result.response;
      return {
        text: response.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
        tokenCount: response.usageMetadata?.totalTokenCount ?? 0,
      };
    })(),
    GeminiError.handle,
  );
```

```typescript
// service/git-operations.service.ts の mergeBranches を修正
// generateContent → generateContentWithMetadata に変更
// tokenCount を createNode に渡す
```

### B-03: Cloud Build マイグレーションステップ追加

**関連:** `docs/logs/014-fix-cloud-sql-schema.md`

**現状:** スキーマ変更時に手動で `gcloud sql instances patch` + `pnpm db:push` が必要

**実装:**

`cloudbuild.yaml` にマイグレーションステップを追加:
```yaml
# Step 0: DB migration
- name: 'node:20'
  entrypoint: 'bash'
  args:
    - '-c'
    - |
      cd backend
      npm install -g pnpm
      pnpm install --frozen-lockfile
      pnpm db:push
  secretEnv: ['DATABASE_URL']
```

Cloud SQL Auth Proxy 経由の接続に対応した `drizzle.config.ts` の修正も必要。

---

## P1: コア機能の拡充

### B-04: cherry-pick

**関連:** Phase 8 T8-1、`02-core-features.md`

**概要:** 別ブランチの特定ノードの内容を現在のブランチに取り込む

**実装:**

```
バックエンド:
  POST /v1/conversations/:conversationId/cherry-pick
  リクエスト: { source_node_id: "uuid", target_branch_id: "uuid" }

  service/git-operations.service.ts に追加:
  1. source_node_id のノードを取得
  2. 新ノードを作成（user_message, ai_response, model, token_count をコピー）
  3. parent_id = target ブランチの head_node_id
  4. branch_id = target_branch_id
  5. metadata = { cherry_picked_from: source_node_id }
  6. target ブランチの head を更新（楽観的ロック）

  routes/git-operations.ts に追加:
  - Zod バリデーション
  - 認証 + 所有者チェック

フロントエンド:
  - NodeContextMenu に「このノードを取り込む」を追加（別ブランチのノードの場合のみ表示）
  - 取り込み先ブランチの選択ダイアログ
```

### B-05: clone

**関連:** Phase 8 T8-2、`02-core-features.md`、`03-repository.md`

**概要:** 公開リポジトリを自分の会話としてコピーする

**実装:**

```
バックエンド:
  POST /v1/repositories/:repositoryId/clone
  レスポンス: { conversation: ConversationRecord }

  service/repository.service.ts に追加:
  1. Repository + RepositoryBranch + RepositoryNode を取得
  2. 新 Conversation 作成（title = リポジトリ名 + " (clone)"）
  3. RepositoryNode → Node にコピー（parent_id のマッピング）
  4. RepositoryBranch → Branch にコピー（head_node_id, base_node_id のマッピング）
  5. Conversation.repository_id = 元リポジトリの ID（参照保持）

フロントエンド:
  - リポジトリ詳細ページに「コピーして使う」ボタン追加
  - clone 完了後、新しい会話画面に遷移
```

### B-06: コンテキスト要約圧縮

**関連:** Phase 8 T8-4、`04-ai-integration.md`

**概要:** パスの合計トークン数が 100,000 tokens を超えた場合に古いノードを自動要約

**実装:**

```typescript
// domain/context-builder.ts の applySummaryMode を拡張

// 1. パスのトークン合計が 100,000 を超えるか判定（既に実装済み）
// 2. 超える場合、先頭から 80,000 以下になるまでのノードを特定
// 3. そのノード群を Gemini に送って要約テキストを生成
// 4. 要約テキストをコンテキストの先頭にシステムメッセージとして配置

// service/chat.service.ts の processChat を修正
// buildContextContents の前に要約が必要かを判定
// 必要な場合は generateContentWithMetadata で要約を生成
// 要約テキストをプレフィックスとしてコンテキストに追加
```

### B-07: リポジトリ詳細のツリービュー

**関連:** `docs/open-issues/repository_tree_view.md`、`docs/open-issues/repository_node_branch_color.md`

**概要:** リポジトリ詳細画面で React Flow のツリーを表示

**実装:**

```
バックエンド:
  shared/color.ts に HSL ハッシュ関数を共通化:
    export const getBranchColor = (id: string): string => { ... }

  routes/repositories.ts の GET /:id/nodes レスポンスに branch_color を追加

フロントエンド:
  components/tree/repository-tree-view.tsx を新規作成:
    - RepositoryNode → React Flow ノード変換
    - parentRepositoryNodeId → エッジ変換
    - nodesConnectable={false}, nodesDraggable={false}
    - ノードクリック → 右パネルに会話内容表示

  app/repository/[id]/page.tsx に「ツリービュー」タブを追加
```

### B-08: 会話エクスポート

**関連:** Phase 8 T8-9、`09-future-features.md`

**概要:** 会話を Markdown / JSON / 要約テキストで出力

**実装:**

```
バックエンド:
  GET /v1/conversations/:conversationId/export?format=markdown&branch_id=uuid

  service/export.service.ts:
    - formatAsMarkdown(nodes): ノードを Markdown に変換
      ```markdown
      ## ユーザー (12:34)
      メッセージ内容

      ## AI (gemini-2.5-flash, 12:35)
      応答内容
      ```
    - formatAsJson(conversation, branches, nodes): 全ツリー構造を JSON 出力
    - generateSummary(nodes): Gemini で会話全体を要約

  routes/export.ts:
    - Content-Type: text/markdown / application/json / text/plain

フロントエンド:
  - 会話画面のヘッダーに「ダウンロード」ボタン追加
  - フォーマット選択ダイアログ
  - ブラウザのファイルダウンロード API で保存
```

---

## P2: ソーシャル・ディスカバリ機能

### B-09: Explore（公開リポジトリ探索）

**関連:** Phase 8 T8-6、`09-future-features.md`

**概要:** 他ユーザーの公開リポジトリを閲覧・発見

**実装:**

```
バックエンド:
  GET /v1/explore/repositories?sort=recent&limit=20&cursor=uuid
  - visibility = 'public' のリポジトリを一覧
  - ソート: recent（更新日時）/ popular（将来: スター数）
  - 認証不要

  routes/explore.ts:
    - optionalAuthMiddleware 適用
    - 公開リポジトリのみ返却

フロントエンド:
  app/explore/page.tsx:
    - リポジトリカード一覧
    - ソートセレクター
    - 無限スクロール

  components/layout/sidebar.tsx に「🔍 探索」リンク追加
```

### B-10: スター（ブックマーク）機能

**関連:** Phase 8 T8-8、`09-future-features.md`

**概要:** 公開リポジトリにスターを付けてブックマーク

**実装:**

```
データモデル:
  db/schema.ts に追加:
    export const stars = pgTable('star', {
      id: uuid('id').primaryKey().defaultRandom(),
      userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
      repositoryId: uuid('repository_id').notNull().references(() => repositories.id, { onDelete: 'cascade' }),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    }, (table) => [
      uniqueIndex('idx_star_unique').on(table.userId, table.repositoryId),
    ]);

バックエンド:
  POST /v1/repositories/:repositoryId/star    — スター追加
  DELETE /v1/repositories/:repositoryId/star  — スター解除
  GET /v1/starred                              — スター済みリポジトリ一覧

フロントエンド:
  - リポジトリ詳細・カードに ⭐ ボタン + スター数表示
  - サイドバーに「⭐ スター済み」リンク追加
```

### B-11: limited_access（制限付きアクセス）

**関連:** Phase 8 T8-5、`06-auth-and-access.md`

**概要:** 招待されたユーザーのみがアクセスできるリポジトリ

**実装:**

```
データモデル:
  1. visibility_type ENUM に 'limited_access' を追加:
     ALTER TYPE visibility_type ADD VALUE 'limited_access';

  2. repository_access テーブルを新規作成:
     export const repositoryAccess = pgTable('repository_access', {
       id: uuid('id').primaryKey().defaultRandom(),
       repositoryId: uuid('repository_id').notNull().references(() => repositories.id, { onDelete: 'cascade' }),
       userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
       grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
     }, (table) => [
       uniqueIndex('idx_repository_access_unique').on(table.repositoryId, table.userId),
     ]);

バックエンド:
  POST /v1/repositories/:repositoryId/access    — ユーザー招待
  DELETE /v1/repositories/:repositoryId/access/:userId  — アクセス取消
  GET /v1/repositories/:repositoryId/access     — アクセス権一覧

  routes/repositories.ts の GET /:id を修正:
    - limited_access の場合、所有者 or repository_access に存在するユーザーのみアクセス可
    - それ以外は 404

フロントエンド:
  - リポジトリ設定タブに「アクセス管理」セクション
  - ユーザー検索 → 招待ボタン
  - 招待済みユーザー一覧 + 取消ボタン
```

---

## P2: UX 改善

### B-12: ツリーの段階的展開（折りたたみ）

**関連:** `docs/open-issues/tree_progressive_disclosure.md`

**実装:**

```
フロントエンド:
  components/tree/tree-view.tsx を修正:
    1. ノードの深さを計算
    2. 深さ > 3 のノードでブランチ head でないものを折りたたみ
    3. 折りたたみノードコンポーネント:
       - 「...（N個のノード）」表示
       - クリックで展開
    4. 展開/折りたたみ状態を Zustand で管理
    5. React Flow の onlyRenderVisibleElements を有効化

  components/tree/collapsed-node.tsx を新規作成:
    - 折りたたまれたノード数を表示
    - クリックハンドラで展開
```

### B-13: CommandPalette (Ctrl+K)

**関連:** `docs/open-issues/command_palette.md`

**実装:**

```
パッケージ:
  pnpm add cmdk

フロントエンド:
  components/ui/command-palette.tsx:
    - cmdk ライブラリベース
    - Ctrl+K でモーダル表示
    - コマンド一覧:
      - 「新しい会話」→ 会話作成
      - 「ブランチ切替 > {name}」→ switch
      - 「ブランチ比較」→ diff view
      - 「会話を統合」→ merge dialog
      - 「リポジトリに保存」→ push dialog
      - 「検索」→ 検索バーにフォーカス
    - ファジー検索対応

  app/layout.tsx にグローバルキーバインド登録
```

### B-14: BroadcastChannel タブ間同期

**関連:** `docs/open-issues/broadcast_channel.md`

**実装:**

```
フロントエンド:
  lib/broadcast.ts:
    const channel = new BroadcastChannel('gitalk-sync');

    export const broadcastEvent = (event: SyncEvent) =>
      channel.postMessage(event);

    export const onSyncEvent = (handler: (event: SyncEvent) => void) => {
      channel.onmessage = (e) => handler(e.data);
    };

    type SyncEvent =
      | { type: 'NODE_CREATED'; conversationId: string }
      | { type: 'BRANCH_SWITCHED'; conversationId: string; branchId: string }
      | { type: 'CONVERSATION_DELETED'; conversationId: string }
      | { type: 'TITLE_UPDATED'; conversationId: string; title: string }
      | { type: 'MERGE_COMPLETED'; conversationId: string }
      | { type: 'BRANCH_RESET'; conversationId: string };

  各操作完了時に broadcastEvent() を呼出
  conversation-store に onSyncEvent リスナーを登録し、受信時に refetch
```

### B-15: tree-store 分離

**関連:** `docs/open-issues/tree_store_separation.md`

**実装:**

```
フロントエンド:
  stores/tree-store.ts:
    type TreeState = {
      flowNodes: ReadonlyArray<Node>;
      flowEdges: ReadonlyArray<Edge>;
      selectedNodeId: string | null;
      setFlowNodes: (nodes: ReadonlyArray<Node>) => void;
      setFlowEdges: (edges: ReadonlyArray<Edge>) => void;
      setSelectedNodeId: (id: string | null) => void;
    };

  tree-view.tsx の useState を tree-store に移行
  他コンポーネント（NodeContextMenu, BranchSelector）から tree-store を参照可能に
```

---

## P3: スケール・インフラ

### B-16: tsvector + GIN インデックスによる全文検索

**関連:** `docs/open-issues/tsvector_search.md`

**実装:**

```
データベース:
  マイグレーション SQL（Drizzle の GENERATED ALWAYS AS 制約）:
    ALTER TABLE node ADD COLUMN search_vector tsvector
      GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(user_message, '') || ' ' || coalesce(ai_response, ''))
      ) STORED;
    CREATE INDEX idx_node_search ON node USING GIN(search_vector);

バックエンド:
  infra/search.ts を修正:
    - ILIKE → search_vector @@ to_tsquery('simple', :query)
    - ts_rank でスコアリング
    - 複数キーワード AND 検索対応: to_tsquery('simple', 'keyword1 & keyword2')

  日本語対応:
    - pg_bigm 拡張の検討（Cloud SQL でサポートされるか確認）
    - または simple 辞書のまま ILIKE とのハイブリッド
```

### B-17: Gemini Context Caching

**関連:** Phase 8 T8-3、`04-ai-integration.md`

**実装:**

```
バックエンド:
  infra/gemini.ts に追加:
    - キャッシュ作成: 合計トークン数 ≥ 32,768 の場合
    - キャッシュ対象: コンテキストの先頭から末尾の1つ前のノード
    - キャッシュ ID をサーバーメモリで保持（Map<branchId, { cacheId, createdAt }>）
    - TTL: 1時間。TTL 切れは自動再作成
    - ブランチ切替時はキャッシュ再作成

  注意: Google AI SDK でのキャッシュ API サポート状況を確認
  （Vertex AI SDK では cachedContent API が利用可能だが、Google AI SDK では制限がある可能性）
```

### B-18: Vertex AI 移行の再調査

**関連:** `docs/open-issues/vertexai.md`

**実装:**

```
調査項目:
  1. GCP Console → Vertex AI → Model Garden でモデルにアクセスできるか
  2. プロジェクトの課金設定・利用規約の同意状況
  3. サービスアカウントの IAM 権限確認

解決した場合:
  - infra/gemini.ts を @google-cloud/vertexai に戻す
  - GEMINI_API_KEY を不要にする（サービスアカウント認証）
  - Secret Manager から GEMINI_API_KEY を削除
  - Terraform を更新
```

### B-19: 共同編集（リアルタイム同期）

**関連:** Phase 8 T8-7、`09-future-features.md`

**概要:** 複数ユーザーが同じ会話ツリーでリアルタイムに共同作業

**実装（大規模）:**

```
Phase 1: WebSocket 基盤
  バックエンド:
    - Hono の WebSocket アダプター導入
    - /ws/conversations/:conversationId エンドポイント
    - 接続管理（Map<conversationId, Set<WebSocket>>）

Phase 2: リアルタイム同期
  - ノード作成/ブランチ操作時に接続中クライアントに通知
  - Cloud Pub/Sub で複数 Cloud Run インスタンス間の同期

Phase 3: 権限モデル
  - Conversation に共有設定を追加
  - 閲覧者/編集者の権限管理
  - ノードへのコメント・リアクション機能

技術検討:
  - CRDTs (Yjs) による競合解決は Phase 3 以降
  - MVP の楽観的ロック（409 CONFLICT）で初期対応
```

---

## 実装順序の推奨

```
Phase A（即時）:
  B-01 specs 更新
  B-02 merge token_count 修正
  B-03 Cloud Build マイグレーション

Phase B（短期）:
  B-04 cherry-pick
  B-05 clone
  B-07 リポジトリツリービュー
  B-15 tree-store 分離

Phase C（中期）:
  B-06 コンテキスト要約圧縮
  B-08 会話エクスポート
  B-09 Explore
  B-10 スター機能
  B-12 ツリー折りたたみ
  B-13 CommandPalette
  B-14 BroadcastChannel

Phase D（長期）:
  B-11 limited_access
  B-16 tsvector 全文検索
  B-17 Context Caching
  B-18 Vertex AI 再調査
  B-19 共同編集
```
