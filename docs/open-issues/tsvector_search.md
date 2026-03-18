# 全文検索が ILIKE で実装されている（tsvector + GIN 未使用）

## 概要
01-data-model.md で定義されている `tsvector` + `GIN` インデックスによる全文検索が未実装。現在は ILIKE（部分一致）で代替している。

## specs の定義（01-data-model.md）
```sql
CREATE TABLE node (
  ...
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(user_message, '') || ' ' || coalesce(ai_response, ''))
  ) STORED
);

CREATE INDEX idx_node_search ON node USING GIN(search_vector);
```

検索クエリ:
```sql
SELECT * FROM node WHERE search_vector @@ to_tsquery('simple', :query);
```

## 現在の実装
- `infra/search.ts` で `ILIKE '%keyword%'` による部分一致検索
- インデックスなし（全行スキャン）
- 単一キーワードのみ対応（スペース区切りの AND 検索は未対応）

## 影響範囲
- **パフォーマンス:** データ量が少ない段階では問題なし。ノード数が 10,000 を超えると ILIKE の全行スキャンが遅延する可能性
- **検索品質:** tsvector はトークン化（形態素解析）により、活用形や表記揺れにも部分的に対応可能。ILIKE は完全な部分文字列一致のみ
- **関連度ランキング:** `ts_rank` によるスコアリングが使えない

## 実装方針
1. `db/schema.ts` の Node テーブルに `search_vector` カラムを追加（GENERATED ALWAYS AS ... STORED）
   - 注: Drizzle ORM では `GENERATED ALWAYS AS` の直接サポートが限定的。マイグレーション SQL で直接追加する必要がある可能性
2. GIN インデックスを作成
3. `infra/search.ts` の `searchNodes` を `@@ to_tsquery()` クエリに変更
4. `ts_rank` でスコアリングし、関連度順でソート
5. 複数キーワードの AND 検索対応（`to_tsquery('simple', 'keyword1 & keyword2')`）

## 今後の対応
- [ ] ノード数が増加してパフォーマンス問題が発生した時点で移行
- [ ] `simple` 辞書で十分か、日本語対応が必要かを検討（`pg_bigm` 等の拡張が必要になる可能性）
- [ ] 07-api-design.md で定義されている `ts_rank` による関連度ランキングを実装
