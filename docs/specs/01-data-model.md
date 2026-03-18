# 01 - データモデル

## 概要

会話をツリー構造で管理するためのデータモデル定義。
すべてのデータは PostgreSQL (Cloud SQL) に格納する。

## ER図（概念）

```
User ─1:N─ Repository ─1:N─ Branch ─1:N─ Node
                                           │
                                      parent_id (自己参照)
```

## エンティティ定義

### User

Firebase Authentication で管理される認証情報と、アプリ固有のユーザー情報。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | PK |
| firebase_uid | VARCHAR | Firebase Auth の UID |
| display_name | VARCHAR | 表示名 |
| avatar_url | VARCHAR | アバター画像URL（nullable） |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |

> **拡張性メモ:** 将来の共同編集に備え、user_id は全エンティティで操作者を追跡できるよう設計する。

### Repository

会話ツリー全体を一つの単位として保存・管理するエンティティ。GitHub的機能の中核。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | PK |
| owner_id | UUID | FK → User.id |
| title | VARCHAR | リポジトリ名 |
| description | TEXT | 説明（nullable） |
| visibility | ENUM | `private` / `public` / `limited_access` |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |

### Conversation

一つのアクティブな会話セッション。リポジトリに push される前の作業領域。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | PK |
| owner_id | UUID | FK → User.id |
| title | VARCHAR | 会話タイトル |
| repository_id | UUID | FK → Repository.id（nullable。push前はnull） |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |

> **設計意図:** Conversation は「ローカルリポジトリ」に相当する。ユーザーがAIと対話する作業領域であり、Repository への push は明示的な操作で行う。

### Branch

会話内のブランチ。ツリー上の特定のパスを表す。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | PK |
| conversation_id | UUID | FK → Conversation.id |
| name | VARCHAR | ブランチ名（例: "main", "pricing-discussion"） |
| head_node_id | UUID | FK → Node.id。このブランチの最新ノード |
| base_node_id | UUID | FK → Node.id。分岐元のノード |
| is_default | BOOLEAN | デフォルトブランチか（mainに相当） |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |

> **設計意図:** `head_node_id` でブランチの先端を追跡し、`base_node_id` で分岐点を記録する。これにより diff（分岐後の差分）が計算できる。

### Node

会話の最小単位。1回のリクエスト→レスポンスのペアが1ノード。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | PK |
| conversation_id | UUID | FK → Conversation.id |
| parent_id | UUID | FK → Node.id（nullable。ルートノードはnull） |
| node_type | ENUM | `message` / `summary` / `system` |
| user_message | TEXT | ユーザーの入力メッセージ |
| ai_response | TEXT | AIの応答 |
| model | VARCHAR | 使用したAIモデル（例: "gemini-1.5-pro"） |
| token_count | INTEGER | このノードのトークン数（コンテキスト管理用） |
| metadata | JSONB | 追加メタデータ（nullable） |
| created_by | UUID | FK → User.id（将来の共同編集対応） |
| created_at | TIMESTAMP | 作成日時 |

> **node_type の用途:**
> - `message`: 通常の会話ノード
> - `summary`: merge 時に作成される要約ノード。`metadata` にマージ元ブランチIDを格納
> - `system`: システムメッセージ（ブランチ作成通知など）

### RepositoryBranch

Repository に push されたブランチの記録。選択的 push を実現するための中間テーブル。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | PK |
| repository_id | UUID | FK → Repository.id |
| source_branch_id | UUID | FK → Branch.id |
| name | VARCHAR | push 時のブランチ名 |
| snapshot_head_node_id | UUID | push 時点の head ノード |
| pushed_at | TIMESTAMP | push 日時 |

> **設計意図:** push はスナップショットとして記録。push 後にローカル（Conversation）で会話を続けても、Repository 側には影響しない。

## ツリー構造とコンテキスト構築

### ノードのツリー構造

```
[N1: ルート] (parent_id: null)
├── [N2] (parent_id: N1)
│   ├── [N3] (parent_id: N2) ← main ブランチの head
│   └── [N4] (parent_id: N2) ← topic-a ブランチの base_node は N2
│       └── [N5] (parent_id: N4) ← topic-a ブランチの head
└── [N6] (parent_id: N1) ← topic-b ブランチの base_node は N1
    └── [N7] (parent_id: N6) ← topic-b ブランチの head
```

### AIへのコンテキスト構築アルゴリズム

あるノード N に対して新しい会話を行う場合:

1. N からルートノードまで `parent_id` を辿り、パス上の全ノードを取得
2. ルート→Nの順に並べ替え
3. 各ノードの `user_message` と `ai_response` を Gemini API の入力として構築
4. 新しいユーザーメッセージを末尾に追加して送信

```
コンテキスト = [N1, N2, N4, N5] + 新しいメッセージ
               ↑ N5(topic-a の head) からルートまでのパス
```

### コンテキスト肥大化への対策

| 戦略 | 説明 | 適用条件 |
|------|------|---------|
| Gemini Context Caching | 共通のプレフィックス部分をキャッシュ | 32,768 tokens 以上の場合 |
| 要約圧縮 | 古いノードをAIで要約して圧縮 | パスの深さが閾値を超えた場合 |
| スライディングウィンドウ | 直近N個のみフルコンテキスト、以前は要約 | ユーザー設定で切替 |

## インデックス戦略

```sql
-- ノードのツリー走査を高速化
CREATE INDEX idx_node_parent ON node(parent_id);
CREATE INDEX idx_node_conversation ON node(conversation_id);

-- ブランチの探索
CREATE INDEX idx_branch_conversation ON branch(conversation_id);

-- リポジトリの所有者検索
CREATE INDEX idx_repository_owner ON repository(owner_id);

-- Conversation の所有者検索
CREATE INDEX idx_conversation_owner ON conversation(owner_id);
```

## 拡張性への配慮

- **共同編集:** `Node.created_by` により、将来マルチユーザーがノードを作成する場面に対応可能
- **リアルタイム同期:** ノードの CRUD をイベントとして発行する設計にしておけば、後から WebSocket / Pub/Sub を差し込める
- **スター機能:** `Star(user_id, repository_id)` テーブルを追加するだけで対応可能
- **検索機能:** `user_message`, `ai_response` に対する全文検索インデックスを後から追加
