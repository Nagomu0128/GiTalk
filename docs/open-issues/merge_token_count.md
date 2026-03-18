# merge 要約ノードの token_count が 0 で保存される問題

## 概要
merge 操作で作成される summary ノードの `token_count` が常に 0 で保存されている。コンテキスト管理（トークン数に基づく要約圧縮判定）に影響する。

## 発生箇所
- `backend/src/service/git-operations.service.ts` の `mergeBranches` 関数
- `createNode` に `tokenCount: 0` をハードコードしている

## 原因
- merge では `generateContent`（非ストリーミング）を使用して要約を生成している
- `generateContent` のレスポンスには `usageMetadata` が含まれるが、現在の実装では取得していない
- chat の `generateContentStream` ではストリーミング完了後に `response.usageMetadata.totalTokenCount` を取得しているが、merge ではこの処理がない

## 影響範囲
- summary ノードの `token_count` が 0 のため、コンテキストの合計トークン数の計算が不正確になる
- `summary` モードの自動要約圧縮（100,000 tokens 閾値）の判定に影響
- ただし現時点では自動要約圧縮自体が未実装（T8-4）のため、実害は限定的

## 修正方法
`infra/gemini.ts` の `generateContent` がレスポンス全体を返すよう修正し、`git-operations.service.ts` の `mergeBranches` で `usageMetadata.totalTokenCount` を取得して `createNode` に渡す。

```typescript
// infra/gemini.ts
export const generateContentWithMetadata = (
  contents: ReadonlyArray<Content>,
  model?: string,
): ResultAsync<{ text: string; tokenCount: number }, GeminiError> =>
  ResultAsync.fromPromise(
    (async () => {
      const client = getClient();
      const resolvedModel = model ?? getDefaultModel();
      const generativeModel = client.getGenerativeModel({ model: resolvedModel });
      const result = await generativeModel.generateContent({ contents: contents as Content[] });
      const response = result.response;
      return {
        text: response.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
        tokenCount: response.usageMetadata?.totalTokenCount ?? 0,
      };
    })(),
    GeminiError.handle,
  );
```

## 今後の対応
- [ ] `generateContentWithMetadata` を実装
- [ ] `mergeBranches` で token_count を正しく保存
- [ ] T8-4（コンテキスト要約圧縮）実装時に合わせて対応可能
