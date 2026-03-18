# 016 - Session 11: 全文検索

## 日時
2026-03-19

## 対象タスク
- T7-6: 全文検索（GET /v1/search、検索 UI）

## 実施内容

### バックエンド

| ファイル | 内容 |
|---------|------|
| `infra/search.ts` | `searchConversations`（タイトル ILIKE 検索）、`searchNodes`（user_message / ai_response ILIKE 検索、JOIN で会話タイトル・ブランチ名を取得） |
| `routes/search.ts` | `GET /v1/search?q=keyword&scope=all&limit=10`。scope: conversations / nodes / all |
| `index.ts` | searchRouter を登録 |

### フロントエンド

| ファイル | 内容 |
|---------|------|
| `components/layout/search-bar.tsx` | 検索バー（Enter で検索、ドロップダウンに結果表示、クリックで会話画面に遷移） |
| `components/layout/global-header.tsx` | SearchBar を GlobalHeader に統合 |

### specs 準拠の確認
- API: 07-api-design.md 準拠（GET /v1/search、q / scope / limit パラメータ、レスポンス形式）
- 検索結果ソート: 更新日時降順（07-api-design.md 準拠）
- 空結果メッセージ: 05-ui-ux.md 準拠（「"{キーワード}" に一致する結果はありませんでした」）

### specs との差分
- **tsvector + GIN インデックス:** specs（01-data-model.md）では `search_vector tsvector GENERATED ALWAYS AS ...` + GIN インデックスで全文検索を実装する設計だったが、現在の実装では ILIKE を使用。理由: Drizzle ORM の db.execute で tsvector クエリを組み立てるより ILIKE が簡潔。データ量が増えた段階で tsvector に移行予定

## スキップした項目
- **tsvector + GIN インデックスによる全文検索:** ILIKE で代替（上記参照）
- **ts_rank による関連度スコアランキング:** 将来対応
- **E2E テスト:** 未実施

## 確認結果
- `tsc --noEmit`: パス
- `pnpm lint`: パス（warning のみ）

## 次のステップ
MVP 完了チェック
