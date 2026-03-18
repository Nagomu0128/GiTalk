# 10 - タスク依存関係と実装順序

## 概要

各実装タスクの依存関係を明示し、MVPに向けた実装順序を定義する。
依存関係を無視した着手は手戻りの原因となるため、このドキュメントに従って開発を進める。

> **参照すべきドキュメント:**
> - コーディングルール: `.claude/skills/coding-rules/SKILL.md`
> - ディレクトリ構成: `12-development-guide.md`
> - API 仕様: `07-api-design.md`（全パスは `/v1` プレフィックス付き）
> - データモデル: `01-data-model.md`

## 推奨実装順序（セッション単位）

関連タスクをグループ化し、各セッションで動作確認可能な単位にまとめたもの。
**Session 1〜5 がクリティカルパス**であり、最優先で進める。

```
Session 1: バックエンド基盤（一括）
──────────────────────────────────────────────────────────
  T0-1 + T0-3 + T0-4
  Drizzle ORM, DB接続, CORS, エラーハンドラー, errorBuilder, appLogger を一度に構築
  ✓ 確認: バックエンドが起動し、ヘルスチェックが通ること

Session 2: 認証基盤（バックエンド）
──────────────────────────────────────────────────────────
  T1-1 + T1-2
  User テーブル + 認証ミドルウェア（getAuthUser）はセットで意味がある
  ✓ 確認: Firebase ID トークンで認証された API 呼び出しが通ること

Session 3: 認証基盤（フロントエンド）+ Firebase設定
──────────────────────────────────────────────────────────
  T0-2 + T1-3
  Firebase Console 設定 + AuthProvider + Google ログイン画面
  ✓ 確認: Google ログイン → バックエンド API 呼び出しが E2E で通ること

Session 4: 会話コア（バックエンド）
──────────────────────────────────────────────────────────
  T2-1 + T2-2 + T2-3 + T2-4
  Conversation, Branch, Node の API + コンテキスト構築ロジックを一貫して実装
  ✓ 確認: 会話作成 → ブランチ確認 → ノード取得 → パス構築が API で動作すること

Session 5: AI チャット（バックエンド）
──────────────────────────────────────────────────────────
  T3-1 + T3-2 + T3-3
  Gemini 連携 + SSE ストリーミング + チャット API はセットで動作確認が必要
  ✓ 確認: curl で POST /v1/conversations/:id/chat → SSE ストリーム → ノード保存が動作すること

  ── ここまでがクリティカルパス。以降は API が揃った状態でUI構築に入る ──

Session 6: チャットUI + ツリー基盤
──────────────────────────────────────────────────────────
  T3-4 + T5-1 + T5-2
  チャット UI と React Flow を同時に組み、会話画面の骨格を作る
  ✓ 確認: ブラウザで会話を送信し、AIの応答がストリーミング表示され、ツリーにノードが表示されること
  ※ ここで初めて「動くアプリ」が見える転換点

Session 7: Git操作（バックエンド）
──────────────────────────────────────────────────────────
  T4-1 + T4-2 + T4-3 + T4-4
  switch, reset, diff, merge の API を一括実装
  ✓ 確認: 各 Git 操作が API レベルで正しく動作すること

Session 8: ツリー↔チャット連携 + Git操作UI
──────────────────────────────────────────────────────────
  T5-3 + T5-4
  ツリーとチャットの双方向連携 + 右クリックメニュー、ブランチ操作パネル等
  ✓ 確認: ノードクリックでチャット切替、右クリックで branch/reset/merge が動作すること

Session 9: 画面UI
──────────────────────────────────────────────────────────
  T6-1 + T6-2 + T6-3 + T6-4 + T6-5
  共通レイアウト、ランディング、ダッシュボード、会話一覧、会話画面統合
  ✓ 確認: 全画面遷移が動作し、レスポンシブ対応が確認できること
  ※ Session 10 と順序入替可能（互いに依存しない）

Session 10: GitHub機能
──────────────────────────────────────────────────────────
  T7-1 + T7-2 + T7-3 + T7-4 + T7-5
  Repository API, Push（RepositoryNode コピー）, 公開範囲, 一覧/詳細 UI
  ✓ 確認: 会話を push → リポジトリ詳細でツリー表示 → 会話削除後もリポジトリにデータが残ること
  ※ Session 9 と順序入替可能

Session 11: 全文検索
──────────────────────────────────────────────────────────
  T7-6
  GET /v1/search エンドポイント + 検索 UI
  ✓ 確認: キーワードで会話・ノードが検索できること
```

## タスク依存関係グラフ

```
Phase 0: 基盤
──────────────────────────────────────────────────────────
  [T0-1] DB基盤（Drizzle ORM + Drizzle Kit + DB接続）
  [T0-2] Firebase Auth セットアップ（Firebase Console）
  [T0-3] Hono ミドルウェア基盤（CORS, エラーハンドラー, ログ）
  [T0-4] 共有ユーティリティ（errorBuilder, appLogger）

Phase 1: 認証 + データ層
──────────────────────────────────────────────────────────
  [T1-1] User テーブル + infra ────── depends on: T0-1
  [T1-2] 認証ミドルウェア ──────────── depends on: T0-2, T0-3, T0-4, T1-1
         (Firebase ID トークン検証、getAuthUser(c)、初回ログイン時 User 自動作成)
  [T1-3] フロントエンド認証 ────────── depends on: T0-2
         (Firebase Auth SDK、AuthProvider、Google ログイン画面)

Phase 2: 会話コア
──────────────────────────────────────────────────────────
  [T2-1] Conversation API ────────── depends on: T1-1, T1-2
         (CRUD + 作成時に "main" ブランチ自動作成)
  [T2-2] Branch API ──────────────── depends on: T2-1
         (CRUD。遡及的分岐を含む)
  [T2-3] Node API ────────────────── depends on: T2-1
         (全ノード取得、ノード詳細、パス取得)
  [T2-4] コンテキスト構築ロジック ─── depends on: T2-3
         (domain/context-builder.ts, domain/lca.ts。WITH RECURSIVE CTE でパス取得、
          summary ノード特別扱い、コンテキストモード full/summary/minimal 適用)

Phase 3: AI チャット
──────────────────────────────────────────────────────────
  [T3-1] Gemini API 連携 ──────────── depends on: T2-4
         (infra/gemini.ts, Vertex AI SDK セットアップ)
  [T3-2] SSE ストリーミング ────────── depends on: T3-1
         (Hono SSE レスポンス + フロントエンド EventSource)
  [T3-3] チャット API ─────────────── depends on: T2-2, T3-2
         (POST /v1/conversations/:id/chat。コンテキスト構築 → Gemini 呼出 → SSE →
          ノード保存（楽観的ロック）→ head 更新。DB保存失敗時は save_failed イベント +
          POST /v1/conversations/:id/retry-save。初回メッセージ後にタイトル自動生成（非同期）)
  [T3-4] チャット UI ──────────────── depends on: T1-3, T3-2
         (ChatView, MessageBubble, MessageInput)

Phase 4: Git 的操作
──────────────────────────────────────────────────────────
  [T4-1] switch / checkout ─────────── depends on: T2-2
  [T4-2] reset ─────────────────────── depends on: T2-2
  [T4-3] diff ──────────────────────── depends on: T2-3 (LCA アルゴリズム)
  [T4-4] merge ─────────────────────── depends on: T3-1, T4-3
         (AI 要約が必要なため Gemini 連携に依存)

Phase 5: ツリー可視化 UI
──────────────────────────────────────────────────────────
  [T5-1] React Flow + ELK.js 基盤 ── depends on: T1-3
  [T5-2] ノードコンポーネント ─────── depends on: T5-1
         (TreeNode, SummaryNode, ブランチ色分け（branch_id → HSL ハッシュ）、孤立ノード半透明)
  [T5-3] ツリー ↔ チャット連携 ────── depends on: T3-4, T5-2
         (ノードクリック→チャット表示切替)
  [T5-4] Git操作のUI統合 ─────────── depends on: T4-1~T4-4, T5-2
         (NodeContextMenu, BranchSelector, MergeDialog)

Phase 6: 画面 UI
──────────────────────────────────────────────────────────
  [T6-1] 共通レイアウト ────────────── depends on: T1-3
         (GlobalHeader, Sidebar)
  [T6-2] ランディングページ ────────── depends on: T6-1
  [T6-3] ダッシュボード ────────────── depends on: T6-1, T2-1
         (最近の会話、マイリポジトリ、ConversationCard, MiniTreePreview)
  [T6-4] 会話一覧 ──────────────────── depends on: T6-1, T2-1
  [T6-5] 会話画面の統合 ────────────── depends on: T5-3, T5-4, T6-1
         (左右分割レイアウト、空の会話ウェルカム画面、ツリー出現アニメーション、
          ヘッダー、push ダイアログ、レスポンシブ)

Phase 7: GitHub 的機能 + 検索
──────────────────────────────────────────────────────────
  [T7-1] Repository API ──────────── depends on: T1-1, T1-2
  [T7-2] Push 機能 ───────────────── depends on: T7-1, T2-2
         (RepositoryNode コピー作成、UPSERT)
  [T7-3] 公開範囲制御 ────────────── depends on: T7-1
  [T7-4] リポジトリ一覧 UI ────────── depends on: T7-1, T6-1
  [T7-5] リポジトリ詳細 UI ────────── depends on: T7-1, T5-1, T5-2
         (閲覧専用ツリービュー、RepositoryNode 表示)
  [T7-6] 全文検索 ────────────────── depends on: T2-3, T7-1
         (GET /v1/search、tsvector + GIN インデックス)

Phase 8: MVP後（優先度順）
──────────────────────────────────────────────────────────
  [T8-1] cherry-pick ──────────────── depends on: T2-2, T2-3
  [T8-2] clone ────────────────────── depends on: T7-1, T2-1
  [T8-3] コンテキストキャッシュ ────── depends on: T3-1
  [T8-4] コンテキスト要約圧縮 ─────── depends on: T3-1
  [T8-5] limited_access ──────────── depends on: T7-3
  [T8-6] Explore（公開リポジトリ）── depends on: T7-4
  [T8-7] 共同編集 ─────────────────── depends on: T2-3, T7-1（WebSocket / Pub/Sub 追加）
  [T8-8] スター機能 ───────────────── depends on: T7-1, T1-1
  [T8-9] エクスポート ─────────────── depends on: T2-3
  [T8-10] フィルター・検索 ────────── depends on: T2-3, T7-1
```

## 依存関係の可視化（DAG）

```
T0-1 ──→ T1-1 ──→ T2-1 ──→ T2-2 ──→ T4-1
  │         │        │        │        T4-2
  │         │        │        ↓        ↓
  │         │        │      T3-3     T5-4
  │         │        │        ↑        ↑
  │         │        ↓        │        │
  │         │      T2-3 ──→ T2-4 ──→ T3-1 ──→ T3-2
  │         │        │                  │        │
  │         │        ↓                  ↓        ↓
  │         │      T4-3 ──────────→ T4-4      T3-4 ──→ T5-3
  │         │                                            ↑
  │         ↓                                           T5-2
  │       T7-1 ──→ T7-2                                  ↑
  │         │       T7-3                                T5-1
  │         │       T7-4                                  ↑
  │         ↓       T7-5                                  │
  │       T7-6                                            │
  │                                                       │
T0-2 ──→ T1-2 ────────────────────────────────────────    │
  │                                                       │
  ↓                                                       │
T1-3 ──→ T6-1 ──→ T6-2                                   │
  │        │       T6-3                                   │
  │        │       T6-4                                   │
  │        │       T6-5                                   │
  └────────┴──────────────────────────────────────────────┘

T0-3 ──→ T1-2
T0-4 ──→ T1-2
```

## クリティカルパス

最も長い依存チェーン（ボトルネック）:

```
T0-1 → T1-1 → T2-1 → T2-3 → T2-4 → T3-1 → T3-2 → T3-3/T3-4 → T5-3 → T5-4 → T6-5
```

**このパスが遅れると全体が遅れる。** 特に以下が律速:
- **T2-4（コンテキスト構築ロジック）:** WITH RECURSIVE CTE、summary ノード特別扱い、コンテキストモード適用
- **T3-1（Gemini API 連携）:** Vertex AI セットアップとAPIの疎通確認
- **T5-3（ツリー↔チャット連携）:** UIの中核となる部分

## 各タスクの詳細

### Phase 0: 基盤

| ID | タスク | 内容 | 成果物 |
|----|--------|------|--------|
| T0-1 | DB基盤 | Drizzle ORM + Drizzle Kit 導入、DB接続設定、全テーブルのスキーマ作成（01-data-model.md に基づく） | `db/schema.ts`, `db/client.ts`, マイグレーションファイル |
| T0-2 | Firebase Auth セットアップ | Firebase Console で Authentication 有効化、Google プロバイダ設定 | Firebase Console 設定完了 |
| T0-3 | Hono ミドルウェア基盤 | CORS 設定、エラーハンドラー（Result → HTTP レスポンス、ts-pattern 使用）、リクエストログ | `middleware/error-handler.ts`, index.ts の CORS 設定 |
| T0-4 | 共有ユーティリティ | errorBuilder、appLogger、レート制限（インメモリ + 抽象化レイヤー）の実装 | `shared/error.ts`, `shared/logger.ts`, `shared/rate-limiter.ts` |

### Phase 1: 認証 + データ層

| ID | タスク | 内容 | 成果物 |
|----|--------|------|--------|
| T1-1 | User テーブル + infra | User スキーマ定義（Drizzle）、infra 層の DB クエリ（findByFirebaseUid, create） | `db/schema.ts` に User 追加、`infra/user.ts` |
| T1-2 | 認証ミドルウェア | Firebase Admin SDK でトークン検証、`getAuthUser(c)` 実装、初回ログイン時 `INSERT ON CONFLICT` で User 自動作成 | `middleware/auth.ts`, `infra/firebase-auth.ts` |
| T1-3 | フロントエンド認証 | Firebase Auth SDK 導入、AuthProvider（Zustand `auth-store.ts`）、Google ログイン画面、未認証リダイレクト | `stores/auth-store.ts`, `providers/auth-provider.tsx`, `app/login/page.tsx` |

### Phase 2: 会話コア

| ID | タスク | 内容 | 成果物 |
|----|--------|------|--------|
| T2-1 | Conversation API | CRUD + soft delete（deleted_at）+ 復元。作成時に "main" ブランチを自動作成して返す（active_branch_id セット） | `routes/conversations.route.ts`, `routes/conversations.ts`, `service/conversation.service.ts`, `infra/conversation.ts` |
| T2-2 | Branch API | CRUD。遡及的分岐（任意ノードからの branch 作成）を含む。デフォルトブランチ削除不可。楽観的ロック | `routes/branches.route.ts`, `routes/branches.ts`, `service/branch.service.ts`, `infra/branch.ts` |
| T2-3 | Node API | 全ノード取得（ツリー構築用、branch_id 含む）、ノード詳細、WITH RECURSIVE CTE によるパス取得 | `routes/nodes.route.ts`, `routes/nodes.ts`, `service/node.service.ts`, `infra/node.ts` |
| T2-4 | コンテキスト構築 | WITH RECURSIVE CTE でパス取得、LCA アルゴリズム、summary ノード特別扱い（固定user文 + ai_response のみ）、コンテキストモード適用（full/summary/minimal） | `domain/context-builder.ts`, `domain/lca.ts`, `domain/tree.ts` |

### Phase 3: AI チャット

| ID | タスク | 内容 | 成果物 |
|----|--------|------|--------|
| T3-1 | Gemini API 連携 | Vertex AI SDK（@google-cloud/vertexai）セットアップ、generateContentStream 呼出 | `infra/gemini.ts` |
| T3-2 | SSE ストリーミング | Hono の SSE レスポンス実装、フロントエンドの EventSource 受信 | `service/chat.service.ts` の SSE 部分、フロントエンド hooks |
| T3-3 | チャット API | `POST /v1/conversations/:id/chat`。コンテキスト構築 → Gemini 呼出 → SSE ストリーム → ノード保存（楽観的ロック）→ head 更新。DB保存失敗時は `save_failed` イベント送信 + `POST /v1/conversations/:id/retry-save`。初回メッセージ後にタイトル自動生成（非同期） | `routes/chat.route.ts`, `routes/chat.ts` |
| T3-4 | チャット UI | ChatView, MessageBubble（Markdown + DOMPurify）, MessageInput（モデル選択、コンテキストモード選択）。Zustand `chat-store.ts` | `components/chat/*`, `stores/chat-store.ts` |

### Phase 4: Git 的操作

| ID | タスク | 内容 | 成果物 |
|----|--------|------|--------|
| T4-1 | switch / checkout | アクティブブランチ切替（active_branch_id 更新）。Zustand `conversation-store.ts` で状態管理 | `routes/git-operations.ts` 内、`stores/conversation-store.ts` |
| T4-2 | reset | `POST /v1/conversations/:id/reset`。head_node_id 変更（楽観的ロック）、孤立ノードはツリーに残す | `routes/git-operations.ts` 内 |
| T4-3 | diff | `GET /v1/conversations/:id/diff`。LCA 特定 → 分岐後ノード取得 | `routes/git-operations.ts` 内 |
| T4-4 | merge | `POST /v1/conversations/:id/merge`。AI 要約プロンプト送信 → summary ノード作成（metadata に merge_source_branch_name 含む）→ head 更新 | `routes/git-operations.ts` 内 |

### Phase 5: ツリー可視化 UI

| ID | タスク | 内容 | 成果物 |
|----|--------|------|--------|
| T5-1 | React Flow + ELK.js 基盤 | パッケージ導入、ELK.js layered レイアウト、ズーム/パン/ミニマップ、onlyRenderVisibleElements | `components/tree/tree-view.tsx`, `components/tree/elk-layout.ts`, `stores/tree-store.ts` |
| T5-2 | ノードコンポーネント | カスタムノード（メッセージ概要、branch_id → HSL ハッシュ色分け、要約ノード破線、孤立ノード opacity:0.4、アクティブノード太枠+グロー）、段階的展開（深さ3初期表示 + 折りたたみ） | `components/tree/tree-node.tsx`, `components/tree/summary-node.tsx` |
| T5-3 | ツリー ↔ チャット連携 | ノードクリック → チャット表示切替、チャット送信 → ツリー更新の双方向同期。BroadcastChannel API でタブ間同期 | 連携ロジック |
| T5-4 | Git操作のUI統合 | NodeContextMenu（右クリック）、BranchSelector、MergeDialog、DiffView、CommandPalette（Ctrl+K） | `components/branch/*`, `components/dialogs/*`, `components/ui/command-palette.tsx` |

### Phase 6: 画面 UI

| ID | タスク | 内容 | 成果物 |
|----|--------|------|--------|
| T6-1 | 共通レイアウト | GlobalHeader（ロゴ、ユーザーメニュー）、Sidebar（会話、リポジトリ、設定）、レスポンシブ対応 | `components/layout/*`, `app/dashboard/layout.tsx` |
| T6-2 | ランディングページ | ヒーローセクション、デモビジュアル（React Flow アニメーション）、機能紹介3カラム | `app/page.tsx` |
| T6-3 | ダッシュボード | 最近の会話（ConversationCard + MiniTreePreview）、マイリポジトリ、「新しい会話を始める」CTA | `app/dashboard/page.tsx`, `components/cards/*` |
| T6-4 | 会話一覧 | グリッド/リスト切替、ソート、コンテキストメニュー（名前変更、削除、push）、削除済み会話の復元 | `app/dashboard/conversations/page.tsx` |
| T6-5 | 会話画面の統合 | 左右分割レイアウト（ツリー + チャット）、空の会話ウェルカム画面 → 初回送信でツリー出現アニメーション、ヘッダー（タイトル編集、ブランチ選択、push ボタン）、PushDialog、レスポンシブ | `app/conversation/[id]/page.tsx`, `components/dialogs/push-dialog.tsx` |

### Phase 7: GitHub 的機能 + 検索

| ID | タスク | 内容 | 成果物 |
|----|--------|------|--------|
| T7-1 | Repository API | CRUD + soft delete（deleted_at）エンドポイント | `routes/repositories.route.ts`, `routes/repositories.ts`, `service/repository.service.ts` |
| T7-2 | Push 機能 | `POST /v1/repositories/:id/push`。RepositoryNode コピー作成（ブランチ head → ルートの全ノードを物理コピー）。再push時は既存 RepositoryNode を CASCADE 削除して置換 | `routes/repositories.ts` 内 |
| T7-3 | 公開範囲制御 | visibility チェック、private は所有者以外 404 返却、optionalAuthMiddleware 適用 | アクセス制御ロジック |
| T7-4 | リポジトリ一覧 UI | リスト形式、公開範囲バッジ、フィルター、ソート | `app/dashboard/repositories/page.tsx` |
| T7-5 | リポジトリ詳細 UI | メタ情報、ブランチ一覧タブ、閲覧専用ツリービュー（RepositoryNode 表示、branch_color 付き）、設定タブ | `app/repository/[id]/page.tsx` |
| T7-6 | 全文検索 | `GET /v1/search`。Node.search_vector (tsvector + GIN) による会話・ノード検索。検索結果UI | `routes/search.route.ts`, `routes/search.ts`, 検索UIコンポーネント |

## MVP完了の定義

以下のすべてが完了した状態:

- [ ] Session 1〜11 の全タスクが完了
- [ ] ユーザーが Google ログインできる
- [ ] 新しい会話を作成し、AIとチャットできる（ストリーミング）
- [ ] 初回メッセージ後にタイトルが自動生成される
- [ ] 会話中にブランチを作成・切替できる
- [ ] 過去のノードから遡及的にブランチを作成できる
- [ ] ブランチをマージ（要約統合）できる
- [ ] reset でブランチの head を過去に戻せる
- [ ] 二つのブランチの diff を表示できる
- [ ] 会話をツリーとして可視化（React Flow）できる
- [ ] 大量ノード時に折りたたみ/展開が動作する
- [ ] 会話をリポジトリに push できる（全ブランチ/選択的）
- [ ] push 後に会話を削除してもリポジトリのデータが残る
- [ ] リポジトリの一覧・詳細を閲覧できる
- [ ] リポジトリの公開範囲を設定できる（private/public）
- [ ] キーワードで会話・ノードを全文検索できる
- [ ] 削除した会話を30日以内に復元できる
