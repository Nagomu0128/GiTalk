import { VertexAI, type Content, type StreamGenerateContentResult } from '@google-cloud/vertexai';
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

const getClient = (): VertexAI =>
  new VertexAI({ project: getProjectId(), location: getLocation() });

export const generateContentStream = (
  contents: ReadonlyArray<Content>,
  model?: string,
): ResultAsync<StreamGenerateContentResult, GeminiError> =>
  ResultAsync.fromPromise(
    (async () => {
      const client = getClient();
      const resolvedModel = model ?? getDefaultModel();
      const generativeModel = client.getGenerativeModel({ model: resolvedModel });

      logger.info('Starting stream', { model: resolvedModel, contentsLength: contents.length });

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

export const generateContentWithMetadata = (
  contents: ReadonlyArray<Content>,
  model?: string,
): ResultAsync<{ text: string; tokenCount: number }, GeminiError> =>
  ResultAsync.fromPromise(
    (async () => {
      const client = getClient();
      const resolvedModel = model ?? getDefaultModel();
      const generativeModel = client.getGenerativeModel({ model: resolvedModel });

      const result = await generativeModel.generateContent({
        contents: contents as Content[],
      });

      const response = result.response;
      return {
        text: response.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
        tokenCount: response.usageMetadata?.totalTokenCount ?? 0,
      };
    })(),
    GeminiError.handle,
  );
