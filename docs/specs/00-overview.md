# 00 - プロジェクト概要

## プロジェクト名

GiTalk — Git + Talk

## ビジョン

既存のAIチャットアプリケーションでは、会話が長くなるにつれ過去の発言を探すことが困難になる。
GiTalkは、AIチャットにgit/GitHubのコンセプトを融合し、会話の**分岐・管理・保存・共有**を構造的に行えるアプリケーションである。

## 解決する課題

1. **会話の埋没:** 長い会話の中から過去の議論を見つけ出すのが困難
2. **単線的な会話:** 一つの話題から複数の方向に探索したくても、既存チャットでは一本道
3. **会話資産の管理不在:** 過去の会話が時系列で並ぶだけで、構造的に管理・再利用できない

## コアコンセプト

### Git的機能 — 会話の分岐と操作

- 会話をツリー構造（ノード）として管理
- 任意のノード（過去の会話含む）からブランチを作成できる（遡及的分岐）
- branch, switch, checkout, merge, reset, cherry-pick, diff, clone をGUIで提供

### GitHub的機能 — 会話の保存と共有

- 会話ツリー全体を「リポジトリ」として保存
- リポジトリの公開範囲を制御（private / public / limited_access）
- 選択的push（全ブランチ or 特定ブランチのみ）

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js (App Router), React Flow, ELK.js |
| バックエンド | Hono.js |
| AI | Gemini API |
| 認証 | Firebase Authentication |
| データベース | PostgreSQL (Cloud SQL) |
| インフラ | GCP (Cloud Run, Cloud SQL, etc.) |
| IaC | Terraform |
| 言語 | TypeScript（全レイヤー統一） |

## MVP スコープ

### 含む

- AIチャット基本機能（Gemini API連携）
- ツリー構造の会話管理（ノード、ブランチ）
- Git的操作（branch, switch, checkout, merge, reset, cherry-pick, diff, clone）
- GitHub的機能（リポジトリ保存、公開範囲制御、選択的push）
- Firebase Authenticationによるユーザー認証
- React Flow によるツリー可視化UI

### 含まない（将来機能）

- 共同編集（リアルタイム同期） — ただし拡張性は確保
- スター（ブックマーク）機能
- 会話エクスポート（ファイル出力・要約出力）
- 高度なフィルター・検索機能

## 設計原則

1. **非エンジニアでも使えるUI:** Gitの概念をGUIで直感的に操作できること
2. **視覚的な会話管理:** ノード・マインドマップ形式で思考を可視化
3. **拡張性:** 共同編集等の将来機能を後から追加できるデータモデル・API設計
4. **コスト効率:** Gemini Context Caching等を活用し、API呼び出しコストを最適化
