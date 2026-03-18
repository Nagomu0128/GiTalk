import { VertexAI, type Content, type StreamGenerateContentResult } from '@google-cloud/vertexai';
import { ResultAsync } from 'neverthrow';
import { errorBuilder, type InferError } from '../shared/error.js';
import { appLogger } from '../shared/logger.js';

const logger = appLogger('gemini');

export const GeminiError = errorBuilder('GeminiError');
export type GeminiError = InferError<typeof GeminiError>;

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'gjh-hack';
const GCP_LOCATION = 'asia-northeast1';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const VALID_MODELS = ['gemini-1.5-flash', 'gemini-1.5-pro'] as const;

type ValidModel = (typeof VALID_MODELS)[number];

export const isValidModel = (model: string): model is ValidModel =>
  (VALID_MODELS as readonly string[]).includes(model);

const getVertexAI = (): VertexAI =>
  new VertexAI({ project: GCP_PROJECT_ID, location: GCP_LOCATION });

export const generateContentStream = (
  contents: ReadonlyArray<Content>,
  model: string = DEFAULT_MODEL,
): ResultAsync<StreamGenerateContentResult, GeminiError> =>
  ResultAsync.fromPromise(
    (async () => {
      const vertexAI = getVertexAI();
      const generativeModel = vertexAI.getGenerativeModel({ model });

      logger.info('Starting stream', { model, contentsLength: contents.length });

      return generativeModel.generateContentStream({
        contents: contents as Content[],
      });
    })(),
    GeminiError.handle,
  );

export const generateContent = (
  contents: ReadonlyArray<Content>,
  model: string = DEFAULT_MODEL,
): ResultAsync<string, GeminiError> =>
  ResultAsync.fromPromise(
    (async () => {
      const vertexAI = getVertexAI();
      const generativeModel = vertexAI.getGenerativeModel({ model });

      const result = await generativeModel.generateContent({
        contents: contents as Content[],
      });

      const response = result.response;
      return response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    })(),
    GeminiError.handle,
  );
