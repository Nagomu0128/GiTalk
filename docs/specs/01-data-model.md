# 01 - データモデル

## 概要

会話をツリー構造で管理するためのデータモデル定義。
すべてのデータは PostgreSQL (Cloud SQL) に格納する。
すべてのタイムスタンプは UTC で保存し、フロントエンドでユーザーのタイムゾーンに変換する。

## ER図（概念）

```
User ─1:N─ Conversation ─1:N─ Branch
  │              │              │
  │              │            1:N
  │              │              │
  │              │            Node (parent_id で自己参照、ツリー構造)
  │              │
  │              └── active_branch_id ──→ Branch
  │
  └─1:N─ Repository ─1:N─ RepositoryBranch ─1:N─ RepositoryNode
```

## ENUM 定義

```sql
CREATE TYPE visibility_type AS ENUM ('private', 'public');
CREATE TYPE node_type AS ENUM ('message', 'summary', 'system');
```

> **MVP スコープ:** `visibility_type` は MVP では `private` / `public` のみ。`limited_access` は将来追加時に ALTER TYPE で拡張する。

## エンティティ定義

### User

Firebase Authentication で管理される認証情報と、アプリ固有のユーザー情報。

```sql
CREATE TABLE "user" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid VARCHAR(128) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  avatar_url VARCHAR(2048),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**制約:**
- `firebase_uid` に UNIQUE 制約を設定し、同一 Firebase UID での重複登録を防止
- 初回サインイン時の User 作成は `INSERT ... ON CONFLICT (firebase_uid) DO NOTHING` で冪等に処理し、同時リクエストによる競合を回避

> **拡張性メモ:** 将来の共同編集に備え、user_id は全エンティティで操作者を追跡できるよう設計する。

### Repository

会話ツリー全体を一つの単位として保存・管理するエンティティ。GitHub的機能の中核。

```sql
CREATE TABLE repository (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  visibility visibility_type NOT NULL DEFAULT 'private',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repository_owner ON repository(owner_id);
CREATE INDEX idx_repository_deleted ON repository(deleted_at) WHERE deleted_at IS NULL;
```

> **Soft delete:** `deleted_at` が NULL でないレコードは削除済み。一覧取得時は `WHERE deleted_at IS NULL` でフィルタ。30日経過後にバッチジョブで物理削除。

### Conversation

一つのアクティブな会話セッション。リポジトリに push される前の作業領域。

```sql
CREATE TABLE conversation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  repository_id UUID REFERENCES repository(id) ON DELETE SET NULL,
  active_branch_id UUID,  -- FK は Branch 作成後に ALTER TABLE で追加
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversation_owner ON conversation(owner_id);
CREATE INDEX idx_conversation_deleted ON conversation(deleted_at) WHERE deleted_at IS NULL;
```

> **設計意図:** Conversation は「ローカルリポジトリ」に相当する。ユーザーがAIと対話する作業領域であり、Repository への push は明示的な操作で行う。`repository_id` は push 済みのリポジトリへの参照であり、push 前は NULL。

> **`active_branch_id`:** 現在ユーザーがアクティブに使用しているブランチ。ブラウザリロードや別デバイスからアクセスした際に、前回の会話位置を復元するために使用。

> **Soft delete:** `deleted_at` が NULL でないレコードは削除済み。「最近削除した会話」として30日間保持し、復元可能。

### Branch

会話内のブランチ。ツリー上の特定のパスを表す。

```sql
CREATE TABLE branch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  head_node_id UUID,  -- FK は Node 作成後に ALTER TABLE で追加
  base_node_id UUID,  -- FK は Node 作成後に ALTER TABLE で追加
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_branch_conversation ON branch(conversation_id);

-- Conversation の FK を後から追加（循環参照回避）
ALTER TABLE conversation ADD CONSTRAINT fk_conversation_active_branch
  FOREIGN KEY (active_branch_id) REFERENCES branch(id) ON DELETE SET NULL;
```

**制約・ルール:**
- `base_node_id` は**イミュータブル**。ブランチ作成時に設定され、以後変更されない。これにより diff 計算時の分岐点が常に明確になる
- `head_node_id` は branch/chat/reset/merge 操作で更新される
- `is_default = TRUE` のブランチは Conversation ごとに**最大1つ**。デフォルトブランチは削除不可
- ブランチ名は同一 Conversation 内で一意
- **楽観的ロック:** head_node_id の更新は `WHERE head_node_id = :expected` 条件付きで行い、同時書き込みを検出する（0行更新 → 409 CONFLICT）

### Node

会話の最小単位。1回のリクエスト→レスポンスのペアが1ノード。

```sql
CREATE TABLE node (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branch(id),
  parent_id UUID REFERENCES node(id) ON DELETE SET NULL,
  node_type node_type NOT NULL DEFAULT 'message',
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  model VARCHAR(50) NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_by UUID NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(user_message, '') || ' ' || coalesce(ai_response, ''))
  ) STORED
);

CREATE INDEX idx_node_parent ON node(parent_id);
CREATE INDEX idx_node_conversation ON node(conversation_id);
CREATE INDEX idx_node_branch ON node(branch_id);
CREATE INDEX idx_node_search ON node USING GIN(search_vector);

-- Branch の FK を後から追加（循環参照回避）
ALTER TABLE branch ADD CONSTRAINT fk_branch_head_node FOREIGN KEY (head_node_id) REFERENCES node(id) ON DELETE SET NULL;
ALTER TABLE branch ADD CONSTRAINT fk_branch_base_node FOREIGN KEY (base_node_id) REFERENCES node(id) ON DELETE SET NULL;
```

**`branch_id` の用途:**
- そのノードが**作成されたブランチ**を記録する
- ツリービューでのブランチ色分けに使用（`branch_id` をハッシュして HSL カラーを生成）
- merge の要約ノード → マージ先ブランチの ID
- cherry-pick ノード → 取り込み先ブランチの ID

**node_type の用途:**
- `message`: 通常の会話ノード
- `summary`: merge 時に作成される要約ノード。`metadata` にマージ元ブランチ情報を格納
- `system`: システムメッセージ（ブランチ作成通知など）。`user_message` にはシステムテキスト、`ai_response` は空文字

**token_count の計算方法:**
- `user_message` と `ai_response` の合計トークン数
- Gemini API のストリーミング完了時に `usage_metadata` から取得し保存
- ストリーミング中断時はノードを保存しない（後述）

**全文検索:**
- `search_vector` は `user_message` と `ai_response` から自動生成される `tsvector` カラム
- GIN インデックスで高速な全文検索を実現
- 検索クエリ: `SELECT * FROM node WHERE search_vector @@ to_tsquery('simple', :query)`

**制約・ルール:**
- `parent_id` は他のノードの `id` を参照する自己参照FK。ルートノードのみ NULL
- 1つの Conversation に対してルートノード（`parent_id = NULL`）は**1つのみ**
- `parent_id` チェーンは必ず**非巡回**（DAGを形成）。アプリケーション層で保証する

### RepositoryBranch

Repository に push されたブランチの記録。選択的 push を実現するための中間テーブル。

```sql
CREATE TABLE repository_branch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES repository(id) ON DELETE CASCADE,
  source_branch_id UUID REFERENCES branch(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  pushed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repository_branch_repo ON repository_branch(repository_id);
CREATE UNIQUE INDEX idx_repository_branch_unique ON repository_branch(repository_id, source_branch_id)
  WHERE source_branch_id IS NOT NULL;
```

### RepositoryNode

Push 時にコピーされたノードデータ。Conversation / Node とは完全に独立しており、会話を削除してもリポジトリのデータは保持される。

```sql
CREATE TABLE repository_node (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_branch_id UUID NOT NULL REFERENCES repository_branch(id) ON DELETE CASCADE,
  original_node_id UUID,
  parent_repository_node_id UUID REFERENCES repository_node(id) ON DELETE SET NULL,
  node_type node_type NOT NULL DEFAULT 'message',
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  model VARCHAR(50) NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  original_branch_name VARCHAR(100),
  original_created_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repository_node_branch ON repository_node(repository_branch_id);
CREATE INDEX idx_repository_node_parent ON repository_node(parent_repository_node_id);
```

> **ブランチ色分け:** `original_branch_name` に元の Branch 名を保存する。リポジトリ閲覧時のツリー色分けは `repository_branch_id` をハッシュして HSL カラーを生成する（Conversation 側の `branch_id` と同じアルゴリズム）。`original_branch_name` はメタ情報として表示に使用。

> **Push のデータ独立性:** Push 時にブランチの head からルートまでのパス上の全ノードを `repository_node` にコピーする。`parent_repository_node_id` は RepositoryNode 内で自己完結するため、元の Conversation を削除してもリポジトリのデータは完全に保持される。

> **再push の挙動:** 同じ `repository_id` + `source_branch_id` の組み合わせで再push した場合、該当 `RepositoryBranch` に紐づく既存の `RepositoryNode` を全削除（CASCADE）し、新しいノード群を INSERT する。

## ツリー構造とコンテキスト構築

### ノードのツリー構造

```
[N1: ルート] (parent_id: null, branch_id: main)
├── [N2] (parent_id: N1, branch_id: main)
│   ├── [N3] (parent_id: N2, branch_id: main) ← main ブランチの head
│   └── [N4] (parent_id: N2, branch_id: topic-a) ← topic-a ブランチの base_node は N2
│       └── [N5] (parent_id: N4, branch_id: topic-a) ← topic-a ブランチの head
└── [N6] (parent_id: N1, branch_id: topic-b) ← topic-b ブランチの base_node は N1
    └── [N7] (parent_id: N6, branch_id: topic-b) ← topic-b ブランチの head
```

### 重要な構造ルール

1. **単一ルート:** 1つの Conversation に `parent_id = NULL` のノードは1つだけ
2. **非巡回:** `parent_id` を辿ると必ずルートに到達する（巡回しない）
3. **ノードの不変性:** 一度作成されたノードの `user_message`、`ai_response`、`parent_id` は変更しない
4. **孤立ノードの扱い:** reset 操作で head から到達不能になったノードは削除しない。ツリー上に**半透明で表示**し、ユーザーが再度 branch を作成して復帰させることができる
5. **空の会話:** 新規作成直後の Conversation はノードが0個。最初のメッセージ送信でルートノードが作成される。ノードが0個の状態ではブランチ作成・Git操作は無効

### AIへのコンテキスト構築アルゴリズム

あるノード N に対して新しい会話を行う場合:

1. N からルートノードまで `parent_id` を辿り、パス上の全ノードを `WITH RECURSIVE` CTE で一括取得
2. ルート→Nの順に並べ替え
3. `node_type = 'system'` のノードはスキップ（コンテキストに含めない）
4. `node_type = 'summary'` のノードは特別扱い（後述）
5. `node_type = 'message'` のノードは `user_message` と `ai_response` を構築
6. 新しいユーザーメッセージを末尾に追加して送信

**パス取得クエリ（WITH RECURSIVE CTE）:**
```sql
WITH RECURSIVE path AS (
  SELECT * FROM node WHERE id = :node_id
  UNION ALL
  SELECT n.* FROM node n
  JOIN path p ON n.id = p.parent_id
)
SELECT * FROM path ORDER BY created_at ASC;
```

**summary ノードのコンテキスト変換:**
```
summary ノードは以下の形式でコンテキストに含める:
  { role: "user",  text: "以下は別トピック「{ブランチ名}」の要約です" }
  { role: "model", text: "{ai_response（要約文）}" }

※ user_message（"〇〇ブランチの統合" 等のシステム的テキスト）は使用しない
※ ブランチ名は metadata.merge_source_branch_name から取得
```

```
コンテキスト = [N1, N2, N4, N5] + 新しいメッセージ
               ↑ N5(topic-a の head) からルートまでのパス
```

### LCA（最近共通祖先）アルゴリズム

diff および merge 操作で使用する。2つのノード A, B の最近共通祖先を求める。

```
関数 findLCA(nodeA, nodeB):
  1. nodeA からルートまでのパスを WITH RECURSIVE CTE で取得 → pathA
  2. pathA を Set に変換 → ancestorsA
  3. nodeB から parent_id を辿り、ancestorsA に含まれる最初のノードを返す
  4. 見つかったノードが LCA
```

**計算量:** O(d) （d = ツリーの最大深さ）。会話の深さは通常数百ノード以内のため、性能問題にはならない。

### コンテキスト肥大化への対策

3つの戦略は以下の優先順位で適用される:

1. **ユーザー選択のコンテキストモード**が最優先
   - `full`: パス上の全ノードをそのまま送信。他の戦略は適用しない
   - `summary`: 後述の要約圧縮を適用
   - `minimal`: 直近 N 個（デフォルト10）のノードのみ送信
2. **要約圧縮**（`summary` モード時）
   - パスの合計トークン数が 100,000 tokens を超えた場合に自動適用
   - パスの先頭から、合計トークン数が 80,000 tokens 以下になるまでのノードを要約
   - 要約はコンテキストの先頭にシステムメッセージとして配置
3. **Gemini Context Caching**（全モード共通）
   - 合計トークン数が 32,768 tokens 以上の場合にキャッシュを作成
   - キャッシュ対象はコンテキストの先頭から末尾の1つ前のノードまで（プレフィックス部分）
   - キャッシュ ID は会話中にメモリ上で保持し、同一セッション内で再利用

### ブランチ色分けアルゴリズム

Node の `branch_id` を使ってフロントエンドで色を決定する:

```typescript
const branchColorMap = new Map<string, string>();

const getBranchColor = (branchId: string): string => {
  if (branchColorMap.has(branchId)) return branchColorMap.get(branchId)!;
  const hash = hashString(branchId);
  const hue = hash % 360;
  const color = `hsl(${hue}, 70%, 50%)`;
  branchColorMap.set(branchId, color);
  return color;
};
```

- ブランチIDをハッシュして HSL の色相を決定
- 彩度・明度は固定（視認性を保つ）
- ノードの左ボーダーに色帯として表示

## インデックス戦略

上記の各 CREATE TABLE / CREATE INDEX 文に統合済み。

## 拡張性への配慮

- **共同編集:** `Node.created_by` により、将来マルチユーザーがノードを作成する場面に対応可能
- **リアルタイム同期:** ノードの CRUD をイベントとして発行する設計にしておけば、後から WebSocket / Pub/Sub を差し込める
- **スター機能:** `Star(user_id, repository_id)` テーブルを追加するだけで対応可能
- **limited_access:** `visibility_type` ENUM に値を追加し、`RepositoryAccess` テーブルを新設
