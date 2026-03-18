# 10 - タスク依存関係と実装順序

## 概要

各実装タスクの依存関係を明示し、MVPに向けた実装順序を定義する。
依存関係を無視した着手は手戻りの原因となるため、このドキュメントに従って開発を進める。

> **参照すべきドキュメント:**
> - コーディングルール: `.claude/skills/coding-rules/SKILL.md`
> - ディレクトリ構成: `12-development-guide.md`
> - API 仕様: `07-api-design.md`（全パスは `/v1` プレフィックス付き）
> - データモデル: `01-data-model.md`

## 依存関係グラフ

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
         (Firebase Auth SDK、AuthProvider、ログイン/サインアップ画面)

Phase 2: 会話コア
──────────────────────────────────────────────────────────
  [T2-1] Conversation API ────────── depends on: T1-1, T1-2
         (CRUD + 作成時に "main" ブランチ自動作成)
  [T2-2] Branch API ──────────────── depends on: T2-1
         (CRUD。遡及的分岐を含む)
  [T2-3] Node API ────────────────── depends on: T2-1
         (全ノード取得、ノード詳細、パス取得)
  [T2-4] コンテキスト構築ロジック ─── depends on: T2-3
         (domain/context-builder.ts, domain/lca.ts)

Phase 3: AI チャット
──────────────────────────────────────────────────────────
  [T3-1] Gemini API 連携 ──────────── depends on: T2-4
         (infra/gemini.ts, Vertex AI SDK セットアップ)
  [T3-2] SSE ストリーミング ────────── depends on: T3-1
         (Hono SSE レスポンス + フロントエンド EventSource)
  [T3-3] チャット API ─────────────── depends on: T2-2, T3-2
         (POST /v1/conversations/:id/chat)
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
         (TreeNode, SummaryNode, ブランチ色分け、孤立ノード半透明)
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
         (左右分割レイアウト、ヘッダー、push ダイアログ)

Phase 7: GitHub 的機能
──────────────────────────────────────────────────────────
  [T7-1] Repository API ──────────── depends on: T1-1, T1-2
  [T7-2] Push 機能 ───────────────── depends on: T7-1, T2-2
         (RepositoryBranch スナップショット作成、UPSERT)
  [T7-3] 公開範囲制御 ────────────── depends on: T7-1
  [T7-4] リポジトリ一覧 UI ────────── depends on: T7-1, T6-1
  [T7-5] リポジトリ詳細 UI ────────── depends on: T7-1, T5-1, T5-2
         (閲覧専用ツリービュー)

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
- **T2-4（コンテキスト構築ロジック）:** ツリー走査アルゴリズムの正確な実装
- **T3-1（Gemini API 連携）:** Vertex AI セットアップとAPIの疎通確認
- **T5-3（ツリー↔チャット連携）:** UIの中核となる部分

## 並行開発が可能なタスク

以下のタスクグループは互いに独立しており、並行して進められる:

| グループ | タスク | 前提 |
|---------|--------|------|
| バックエンド基盤 | T0-1, T0-3, T0-4 | なし |
| 認証基盤 | T0-2, T1-3 | なし（フロントエンド側は独立） |
| Git操作 | T4-1, T4-2, T4-3 | T2-2 完了後に並行可能 |
| ツリーUI | T5-1, T5-2 | T1-3 完了後に並行可能 |
| 画面UI | T6-1~T6-4 | T1-3 完了後、Phase 3-5 と並行可能 |
| GitHub機能 | T7-1~T7-5 | T1-1, T1-2 完了後、Phase 3-5 と並行可能 |

## 各タスクの詳細

### Phase 0: 基盤

| ID | タスク | 内容 | 成果物 |
|----|--------|------|--------|
| T0-1 | DB基盤 | Drizzle ORM + Drizzle Kit 導入、DB接続設定、初期スキーマ作成（01-data-model.md に基づく） | `db/schema.ts`, `db/client.ts`, マイグレーションファイル |
| T0-2 | Firebase Auth セットアップ | Firebase Console で Authentication 有効化、Google / Email プロバイダ設定 | Firebase Console 設定完了 |
| T0-3 | Hono ミドルウェア基盤 | CORS 設定、エラーハンドラー（Result → HTTP レスポンス、ts-pattern 使用）、リクエストログ | `middleware/error-handler.ts`, index.ts の CORS 設定 |
| T0-4 | 共有ユーティリティ | errorBuilder、appLogger の実装 | `shared/error.ts`, `shared/logger.ts` |

### Phase 1: 認証 + データ層

| ID | タスク | 内容 | 成果物 |
|----|--------|------|--------|
| T1-1 | User テーブル + infra | User スキーマ定義（Drizzle）、infra 層の DB クエリ（findByFirebaseUid, create） | `db/schema.ts` に User 追加、`infra/user.ts` |
| T1-2 | 認証ミドルウェア | Firebase Admin SDK でトークン検証、`getAuthUser(c)` 実装、初回ログイン時 `INSERT ON CONFLICT` で User 自動作成 | `middleware/auth.ts`, `infra/firebase-auth.ts` |
| T1-3 | フロントエンド認証 | Firebase Auth SDK 導入、AuthProvider、ログイン/サインアップ画面、未認証リダイレクト | `providers/auth-provider.tsx`, `app/login/page.tsx` |

### Phase 2: 会話コア

| ID | タスク | 内容 | 成果物 |
|----|--------|------|--------|
| T2-1 | Conversation API | CRUD。作成時に "main" ブランチを自動作成して返す | `routes/conversations.route.ts`, `routes/conversations.ts`, `service/conversation.service.ts`, `infra/conversation.ts` |
| T2-2 | Branch API | CRUD。遡及的分岐（任意ノードからの branch 作成）を含む。デフォルトブランチ削除不可 | `routes/branches.route.ts`, `routes/branches.ts`, `service/branch.service.ts`, `infra/branch.ts` |
| T2-3 | Node API | 全ノード取得（ツリー構築用）、ノード詳細、パス取得 | `routes/nodes.route.ts`, `routes/nodes.ts`, `service/node.service.ts`, `infra/node.ts` |
| T2-4 | コンテキスト構築 | parent_id 走査、ルートまでのパス構築、LCA アルゴリズム、コンテキストモード適用（full/summary/minimal） | `domain/context-builder.ts`, `domain/lca.ts`, `domain/tree.ts` |

### Phase 3: AI チャット

| ID | タスク | 内容 | 成果物 |
|----|--------|------|--------|
| T3-1 | Gemini API 連携 | Vertex AI SDK（@google-cloud/vertexai）セットアップ、generateContentStream 呼出 | `infra/gemini.ts` |
| T3-2 | SSE ストリーミング | Hono の SSE レスポンス実装、フロントエンドの EventSource 受信 | `service/chat.service.ts` の SSE 部分、フロントエンド hooks |
| T3-3 | チャット API | `POST /v1/conversations/:id/chat`。コンテキスト構築 → Gemini 呼出 → SSE ストリーム → ノード保存 → head 更新 | `routes/chat.route.ts`, `routes/chat.ts` |
| T3-4 | チャット UI | ChatView, MessageBubble（Markdown レンダリング + DOMPurify）, MessageInput（モデル選択、コンテキストモード選択） | `components/chat/*` |

### Phase 4: Git 的操作

| ID | タスク | 内容 | 成果物 |
|----|--------|------|--------|
| T4-1 | switch / checkout | アクティブブランチ切替。フロントエンドの状態管理 + チャットビュー切替 | `routes/git-operations.ts` 内、フロントエンド状態管理 |
| T4-2 | reset | `POST /v1/conversations/:id/reset`。head_node_id 変更、孤立ノードはツリーに残す | `routes/git-operations.ts` 内 |
| T4-3 | diff | `GET /v1/conversations/:id/diff`。LCA 特定 → 分岐後ノード取得 → 左右分割表示 | `routes/git-operations.ts` 内、`components/dialogs/diff-view.tsx` |
| T4-4 | merge | `POST /v1/conversations/:id/merge`。AI 要約プロンプト送信 → summary ノード作成 → head 更新 | `routes/git-operations.ts` 内、`components/dialogs/merge-dialog.tsx` |

### Phase 5: ツリー可視化 UI

| ID | タスク | 内容 | 成果物 |
|----|--------|------|--------|
| T5-1 | React Flow + ELK.js 基盤 | パッケージ導入、ELK.js layered レイアウト、ズーム/パン/ミニマップ | `components/tree/tree-view.tsx`, `components/tree/elk-layout.ts` |
| T5-2 | ノードコンポーネント | カスタムノード（メッセージ概要、ブランチ色分け、要約ノード破線、孤立ノード opacity:0.4、アクティブノード太枠+グロー） | `components/tree/tree-node.tsx`, `components/tree/summary-node.tsx` |
| T5-3 | ツリー ↔ チャット連携 | ノードクリック → チャット表示切替、チャット送信 → ツリー更新の双方向同期 | 連携ロジック |
| T5-4 | Git操作のUI統合 | NodeContextMenu（右クリック）、BranchSelector、MergeDialog、DiffView、CommandPalette | `components/branch/*`, `components/dialogs/*`, `components/ui/command-palette.tsx` |

### Phase 6: 画面 UI

| ID | タスク | 内容 | 成果物 |
|----|--------|------|--------|
| T6-1 | 共通レイアウト | GlobalHeader（ロゴ、ユーザーメニュー）、Sidebar（会話、リポジトリ、設定）、レスポンシブ対応 | `components/layout/*`, `app/dashboard/layout.tsx` |
| T6-2 | ランディングページ | ヒーローセクション、デモビジュアル（React Flow アニメーション）、機能紹介3カラム | `app/page.tsx` |
| T6-3 | ダッシュボード | 最近の会話（ConversationCard + MiniTreePreview）、マイリポジトリ、「新しい会話を始める」CTA | `app/dashboard/page.tsx`, `components/cards/*` |
| T6-4 | 会話一覧 | グリッド/リスト切替、ソート、コンテキストメニュー（名前変更、削除、push）、ページネーション | `app/dashboard/conversations/page.tsx` |
| T6-5 | 会話画面の統合 | 左右分割レイアウト（ツリー + チャット）、ヘッダー（タイトル編集、ブランチ選択、push ボタン）、PushDialog、レスポンシブ（タブレット: タブ切替、モバイル: ボトムシート） | `app/conversation/[id]/page.tsx`, `components/dialogs/push-dialog.tsx` |

### Phase 7: GitHub 的機能

| ID | タスク | 内容 | 成果物 |
|----|--------|------|--------|
| T7-1 | Repository API | CRUD エンドポイント | `routes/repositories.route.ts`, `routes/repositories.ts`, `service/repository.service.ts` |
| T7-2 | Push 機能 | `POST /v1/repositories/:id/push`。RepositoryBranch UPSERT（同一 repo+branch は UPDATE）、選択的 push | `routes/repositories.ts` 内 |
| T7-3 | 公開範囲制御 | visibility チェック、private は所有者以外 404 返却、optionalAuthMiddleware 適用 | アクセス制御ロジック |
| T7-4 | リポジトリ一覧 UI | リスト形式、公開範囲バッジ、フィルター、ソート | `app/dashboard/repositories/page.tsx` |
| T7-5 | リポジトリ詳細 UI | メタ情報、ブランチ一覧タブ、閲覧専用ツリービュー（ノードクリックで内容表示）、設定タブ | `app/repository/[id]/page.tsx` |

## MVP完了の定義

以下のすべてが完了した状態:

- [ ] Phase 0〜7 の全タスクが完了
- [ ] ユーザーがサインアップ/ログインできる
- [ ] 新しい会話を作成し、AIとチャットできる（ストリーミング）
- [ ] 会話中にブランチを作成・切替できる
- [ ] 過去のノードから遡及的にブランチを作成できる
- [ ] ブランチをマージ（要約統合）できる
- [ ] reset でブランチの head を過去に戻せる
- [ ] 二つのブランチの diff を表示できる
- [ ] 会話をツリーとして可視化（React Flow）できる
- [ ] 会話をリポジトリに push できる（全ブランチ/選択的）
- [ ] リポジトリの一覧・詳細を閲覧できる
- [ ] リポジトリの公開範囲を設定できる（private/public）
