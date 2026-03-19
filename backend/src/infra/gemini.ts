import { GoogleGenerativeAI, type Content, type GenerateContentStreamResult } from '@google/generative-ai';
import { ResultAsync } from 'neverthrow';
import { errorBuilder, type InferError } from '../shared/error.js';
import { appLogger } from '../shared/logger.js';

export type { Content };

const logger = appLogger('gemini');

export const GeminiError = errorBuilder('GeminiError');
export type GeminiError = InferError<typeof GeminiError>;

const VALID_MODELS = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.5-flash'] as const;

type ValidModel = (typeof VALID_MODELS)[number];

export const isValidModel = (model: string): model is ValidModel =>
  (VALID_MODELS as readonly string[]).includes(model);

const getDefaultModel = (): string => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const getClient = (): GoogleGenerativeAI => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  return new GoogleGenerativeAI(apiKey);
};

export const generateContentStream = (
  contents: ReadonlyArray<Content>,
  model?: string,
): ResultAsync<GenerateContentStreamResult, GeminiError> =>
  ResultAsync.fromPromise(
    (async () => {
      const client = getClient();
      const resolvedModel = model ?? getDefaultModel();
      const generativeModel = client.getGenerativeModel({ model: resolvedModel });

      logger.info('Starting stream', {
        model: resolvedModel,
        contentsLength: contents.length,
        provider: 'google-ai',
      });

      return generativeModel.generateContentStream({
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
      const client = getClient();
      const resolvedModel = model ?? getDefaultModel();
      const generativeModel = client.getGenerativeModel({ model: resolvedModel });

      const result = await generativeModel.generateContent({
        contents: contents as Content[],
      });

      const response = result.response;
      return response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    })(),
    GeminiError.handle,
  );
