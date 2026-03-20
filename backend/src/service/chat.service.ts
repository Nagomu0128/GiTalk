import type { Content } from '../infra/gemini.js';
import { getPathToRoot, createNode } from '../infra/node.js';
import { findBranchById, updateBranchHead, updateBranchCache } from '../infra/branch.js';
import { updateConversation } from '../infra/conversation.js';
import {
  generateContentStream,
  generateContentStreamWithCache,
  generateContent,
  createContextCache,
  shouldUseCache,
  isCacheValid,
  isValidModel,
} from '../infra/gemini.js';
import { buildContextContents } from '../domain/context-builder.js';
import { errorBuilder, type InferError } from '../shared/error.js';
import { appLogger } from '../shared/logger.js';

const sanitizeAiResponse = (text: string): string =>
  text
    .replace(/SPECIAL INSTRUCTION:.*?(?=\n\n|\n[^S]|$)/gs, '')
    .replace(/^(初めまして！.*?お願いします。\s*)/m, '')
    .trim();

const logger = appLogger('chatService');

export const ChatError = errorBuilder('ChatError');
export type ChatError = InferError<typeof ChatError>;

type ContextMode = 'full' | 'summary' | 'minimal';

type ChatParams = {
  readonly conversationId: string;
  readonly branchId: string;
  readonly message: string;
  readonly model: string;
  readonly contextMode: ContextMode;
  readonly userId: string;
};

type StreamCallbacks = {
  readonly onChunk: (content: string) => Promise<void> | void;
  readonly onDone: (nodeId: string, tokenCount: number) => Promise<void> | void;
  readonly onError: (code: string, message: string) => Promise<void> | void;
  readonly onSaveFailed: (userMessage: string, aiResponse: string) => Promise<void> | void;
  readonly onTitleGenerated: (title: string) => Promise<void> | void;
};

export const processChat = async (
  params: ChatParams,
  callbacks: StreamCallbacks,
): Promise<void> => {
  if (!isValidModel(params.model)) {
    await callbacks.onError('INVALID_MODEL', `Invalid model: ${params.model}`);
    return;
  }

  const branchResult = await findBranchById(params.branchId, params.conversationId);
  if (branchResult.isErr() || !branchResult.value) {
    await callbacks.onError('NOT_FOUND', 'Branch not found');
    return;
  }

  const branch = branchResult.value;
  const parentNodeId = branch.headNodeId;

  // コンテキスト構築
  const contextContents: Content[] = parentNodeId
    ? await getPathToRoot(parentNodeId).match(
        (path) => buildContextContents(path, params.contextMode) as Content[],
        (error) => {
          logger.error('Failed to build context', { error: error.message });
          return [] as Content[];
        },
      )
    : [];

  // コンテキストのトークン数を推定（各Contentのテキスト文字数から概算）
  const estimatedContextTokens = contextContents.reduce(
    (sum, c) => sum + (c.parts ?? []).reduce((s, p) => s + ('text' in p ? (p.text?.length ?? 0) : 0), 0) / 4,
    0,
  );

  // 新しいメッセージ（キャッシュには含めない — ユーザーの最新メッセージのみ非キャッシュ）
  const userContent: Content = { role: 'user' as const, parts: [{ text: params.message }] };

  // キャッシング判定 & Gemini API ストリーミング呼出
  const streamResult = await resolveStream(
    branch,
    contextContents,
    userContent,
    estimatedContextTokens,
    params.model,
  );

  if (streamResult.isErr()) {
    logger.error('Gemini stream failed', { error: streamResult.error.message });
    await callbacks.onError('AI_SERVICE_UNAVAILABLE', 'AI service is currently unavailable');
    return;
  }

  const stream = streamResult.value;
  const chunks: string[] = [];

  try {
    let tokenCount = 0;

    for await (const chunk of stream) {
      const text = chunk.text ?? '';
      if (text) {
        chunks.push(text);
        await callbacks.onChunk(text);
      }
      // 最後のチャンクに usageMetadata が含まれる
      if (chunk.usageMetadata?.totalTokenCount) {
        tokenCount = chunk.usageMetadata.totalTokenCount;
      }
    }

    const aiResponse = sanitizeAiResponse(chunks.join(''));

    // ノード保存
    const nodeResult = await createNode({
      conversationId: params.conversationId,
      branchId: params.branchId,
      parentId: parentNodeId,
      nodeType: 'message',
      userMessage: params.message,
      aiResponse,
      model: params.model,
      tokenCount,
      metadata: null,
      createdBy: params.userId,
    });

    if (nodeResult.isErr()) {
      logger.error('Failed to save node', { error: nodeResult.error.message });
      await callbacks.onSaveFailed(params.message, aiResponse);
      return;
    }

    const node = nodeResult.value;

    // ブランチの head を更新（楽観的ロック）
    const headUpdateResult = await updateBranchHead(
      params.branchId,
      node.id,
      parentNodeId,
    );

    if (headUpdateResult.isErr() || !headUpdateResult.value) {
      logger.error('Failed to update branch head (conflict?)');
      await callbacks.onSaveFailed(params.message, aiResponse);
      return;
    }

    await callbacks.onDone(node.id, tokenCount);

    // 初回メッセージの場合、タイトル自動生成（ストリーム内で完了を待つ）
    if (!parentNodeId) {
      await generateTitle(params.conversationId, params.message, aiResponse, params.model, params.userId, callbacks);
    }
  } catch (error) {
    logger.error('Stream interrupted', { error });
    await callbacks.onError('STREAM_INTERRUPTED', 'Streaming was interrupted');
  }
};

// ============================================================
// キャッシング判定 → ストリーム取得
// ============================================================

type BranchLike = {
  readonly id: string;
  readonly cacheName: string | null;
  readonly cacheCreatedAt: Date | null;
};

const resolveStream = async (
  branch: BranchLike,
  contextContents: ReadonlyArray<Content>,
  userContent: Content,
  estimatedContextTokens: number,
  model: string,
) => {
  // 1. 既存の有効なキャッシュがある場合 → キャッシュ付きストリーム
  if (branch.cacheName && isCacheValid(branch.cacheCreatedAt)) {
    logger.info('Using existing cache', { cacheName: branch.cacheName, branchId: branch.id });
    return generateContentStreamWithCache(branch.cacheName, [userContent], model);
  }

  // 2. コンテキストが十分大きい場合 → 新規キャッシュ作成してからストリーム
  if (shouldUseCache(estimatedContextTokens) && contextContents.length > 0) {
    logger.info('Creating new context cache', { estimatedTokens: estimatedContextTokens, branchId: branch.id });

    const cacheResult = await createContextCache(contextContents as Content[], model);

    if (cacheResult.isOk()) {
      const cacheName = cacheResult.value;
      // DB にキャッシュ名を保存（失敗してもストリームは続行）
      await updateBranchCache(branch.id, cacheName).match(
        () => logger.info('Branch cache saved', { branchId: branch.id, cacheName }),
        (err) => logger.warn('Failed to save branch cache', { error: err.message }),
      );

      return generateContentStreamWithCache(cacheName, [userContent], model);
    }

    // キャッシュ作成失敗 → フォールバックで通常ストリーム
    logger.warn('Cache creation failed, falling back to standard stream', {
      error: cacheResult.error.message,
    });
  }

  // 3. 通常のストリーム
  return generateContentStream([...contextContents, userContent] as Content[], model);
};

const generateTitle = async (
  conversationId: string,
  userMessage: string,
  aiResponse: string,
  model: string,
  userId: string,
  callbacks: StreamCallbacks,
): Promise<void> => {
  const titleContents: Content[] = [
    {
      role: 'user',
      parts: [
        {
          text: `以下の会話に20文字以内の短いタイトルをつけてください。タイトルのみを出力してください。\n\nユーザー: ${userMessage}\nAI: ${aiResponse.slice(0, 500)}`,
        },
      ],
    },
  ];

  await generateContent(titleContents, model)
    .andThen((title) => {
      const trimmed = title.trim().replace(/^["「]|["」]$/g, '');
      return updateConversation(conversationId, userId, { title: trimmed });
    })
    .match(
      async (updated) => {
        if (updated) {
          await callbacks.onTitleGenerated(updated.title);
        }
      },
      (error) => {
        logger.warn('Title generation failed (silent)', { error: error.message });
      },
    );
};
