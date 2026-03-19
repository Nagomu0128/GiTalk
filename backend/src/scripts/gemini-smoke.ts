import 'dotenv/config';
import { generateContent } from '../infra/gemini.js';

const run = async (): Promise<void> => {
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('[gemini-smoke] GEMINI_API_KEY is not set');
    process.exitCode = 1;
    return;
  }

  console.log('[gemini-smoke] start', { model });

  const contents = [{ role: 'user', parts: [{ text: 'Reply with OK only.' }] }];

  await generateContent(contents, model).match(
    (text) => {
      console.log('[gemini-smoke] success', { response: text.trim() });
    },
    (error) => {
      console.error('[gemini-smoke] failed', { message: error.message });
      process.exitCode = 1;
    },
  );
};

void run();
