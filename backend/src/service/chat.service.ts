import type { Content } from '@google/generative-ai';
import { getPathToRoot, createNode } from '../infra/node.js';
import { findBranchById, updateBranchHead } from '../infra/branch.js';
import { updateConversation } from '../infra/conversation.js';
import { generateContentStream, generateContent, isValidModel } from '../infra/gemini.js';
import { buildContextContents } from '../domain/context-builder.js';
import { errorBuilder, type InferError } from '../shared/error.js';
import { appLogger } from '../shared/logger.js';

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

  // 新しいメッセージを追加
  const contents: Content[] = [
    ...contextContents,
    { role: 'user' as const, parts: [{ text: params.message }] },
  ];

  // Gemini API ストリーミング呼出
  const streamResult = await generateContentStream(contents, params.model);

  if (streamResult.isErr()) {
    logger.error('Gemini stream failed', { error: streamResult.error.message });
    await callbacks.onError('AI_SERVICE_UNAVAILABLE', 'AI service is currently unavailable');
    return;
  }

  const stream = streamResult.value;
  const chunks: string[] = [];

  try {
    const responseStream = stream.stream;

    for await (const chunk of responseStream) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (text) {
        chunks.push(text);
        await callbacks.onChunk(text);
      }
    }

    // ストリーミング完了 → 集約レスポンスからトークン数を取得
    const aggregatedResponse = await stream.response;
    const tokenCount = aggregatedResponse.usageMetadata?.totalTokenCount ?? 0;
    const aiResponse = chunks.join('');

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

    // 初回メッセージの場合、タイトル自動生成（非同期）
    if (!parentNodeId) {
      generateTitle(params.conversationId, params.message, aiResponse, params.model, params.userId, callbacks);
    }
  } catch (error) {
    logger.error('Stream interrupted', { error });
    await callbacks.onError('STREAM_INTERRUPTED', 'Streaming was interrupted');
  }
};

const generateTitle = (
  conversationId: string,
  userMessage: string,
  aiResponse: string,
  model: string,
  userId: string,
  callbacks: StreamCallbacks,
): void => {
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

  generateContent(titleContents, model)
    .andThen((title) => {
      const trimmed = title.trim().replace(/^["「]|["」]$/g, '');
      return updateConversation(conversationId, userId, { title: trimmed });
    })
    .match(
      (updated) => {
        if (updated) {
          callbacks.onTitleGenerated(updated.title);
        }
      },
      (error) => {
        logger.warn('Title generation failed (silent)', { error: error.message });
      },
    );
};
