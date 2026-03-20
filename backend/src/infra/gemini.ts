import { GoogleGenAI, type Content, type GenerateContentResponse } from '@google/genai';
import { ResultAsync } from 'neverthrow';
import { errorBuilder, type InferError } from '../shared/error.js';
import { appLogger } from '../shared/logger.js';

const logger = appLogger('gemini');

export const GeminiError = errorBuilder('GeminiError');
export type GeminiError = InferError<typeof GeminiError>;

export type { Content };

const VALID_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'] as const;

type ValidModel = (typeof VALID_MODELS)[number];

export const isValidModel = (model: string): model is ValidModel =>
  (VALID_MODELS as readonly string[]).includes(model);

const getProjectId = (): string => process.env.GCP_PROJECT_ID || 'gitalk-01100128';
const getLocation = (): string => process.env.GCP_LOCATION || 'us-central1';
const getDefaultModel = (): string => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const CACHE_TTL_SECONDS = 3600;
const CACHE_MIN_TOKENS = 32768;

const getClient = (): GoogleGenAI =>
  new GoogleGenAI({
    vertexai: true,
    project: getProjectId(),
    location: getLocation(),
  });

// ============================================================
// Standard (non-cached) API
// ============================================================

export const generateContentStream = (
  contents: ReadonlyArray<Content>,
  model?: string,
): ResultAsync<AsyncGenerator<GenerateContentResponse>, GeminiError> =>
  ResultAsync.fromPromise(
    (async () => {
      const ai = getClient();
      const resolvedModel = model ?? getDefaultModel();

      logger.info('Starting stream', { model: resolvedModel, contentsLength: contents.length });

      return ai.models.generateContentStream({
        model: resolvedModel,
        contents: contents as Content[],
      });
    })(),
    GeminiError.handle,
  );

export const generateContent = (
  contents: ReadonlyArray<Content>,
  model?: string,
): ResultAsync<string, GeminiError> =>
  ResultAsync.fromPromise(
    (async () => {
      const ai = getClient();
      const resolvedModel = model ?? getDefaultModel();

      const response = await ai.models.generateContent({
        model: resolvedModel,
        contents: contents as Content[],
      });

      return response.text ?? '';
    })(),
    GeminiError.handle,
  );

export const generateContentWithMetadata = (
  contents: ReadonlyArray<Content>,
  model?: string,
): ResultAsync<{ text: string; tokenCount: number }, GeminiError> =>
  ResultAsync.fromPromise(
    (async () => {
      const ai = getClient();
      const resolvedModel = model ?? getDefaultModel();

      const response = await ai.models.generateContent({
        model: resolvedModel,
        contents: contents as Content[],
      });

      return {
        text: response.text ?? '',
        tokenCount: response.usageMetadata?.totalTokenCount ?? 0,
      };
    })(),
    GeminiError.handle,
  );

// ============================================================
// Context Caching API
// ============================================================

export const shouldUseCache = (totalTokens: number): boolean =>
  totalTokens >= CACHE_MIN_TOKENS;

export const isCacheValid = (cacheCreatedAt: Date | null): boolean => {
  if (!cacheCreatedAt) return false;
  const ageMs = Date.now() - cacheCreatedAt.getTime();
  return ageMs < CACHE_TTL_SECONDS * 1000;
};

export const createContextCache = (
  contents: ReadonlyArray<Content>,
  model?: string,
): ResultAsync<string, GeminiError> =>
  ResultAsync.fromPromise(
    (async () => {
      const ai = getClient();
      const resolvedModel = model ?? getDefaultModel();

      logger.info('Creating context cache', { model: resolvedModel, contentsLength: contents.length });

      const cached = await ai.caches.create({
        model: resolvedModel,
        config: {
          contents: contents as Content[],
          ttl: `${CACHE_TTL_SECONDS}s`,
        },
      });

      const cacheName = cached.name;
      if (!cacheName) {
        throw new Error('Cache creation returned no name');
      }

      logger.info('Context cache created', { cacheName });
      return cacheName;
    })(),
    GeminiError.handle,
  );

export const generateContentStreamWithCache = (
  cacheName: string,
  contents: ReadonlyArray<Content>,
  model?: string,
): ResultAsync<AsyncGenerator<GenerateContentResponse>, GeminiError> =>
  ResultAsync.fromPromise(
    (async () => {
      const ai = getClient();
      const resolvedModel = model ?? getDefaultModel();

      logger.info('Starting cached stream', { cacheName, contentsLength: contents.length });

      return ai.models.generateContentStream({
        model: resolvedModel,
        contents: contents as Content[],
        config: { cachedContent: cacheName },
      });
    })(),
    GeminiError.handle,
  );

export const deleteContextCache = (
  cacheName: string,
): ResultAsync<void, GeminiError> =>
  ResultAsync.fromPromise(
    (async () => {
      const ai = getClient();
      await ai.caches.delete({ name: cacheName });
      logger.info('Context cache deleted', { cacheName });
    })(),
    GeminiError.handle,
  );
