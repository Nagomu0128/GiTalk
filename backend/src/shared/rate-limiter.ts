import { err, ok, type Result } from 'neverthrow';
import { errorBuilder, type InferError } from './error.js';

export const RateLimitError = errorBuilder('RateLimitError');
export type RateLimitError = InferError<typeof RateLimitError>;

type RateLimitResult = Result<{ readonly allowed: true }, RateLimitError>;

type RateLimiter = {
  readonly check: (key: string) => RateLimitResult;
};

type WindowEntry = {
  readonly count: number;
  readonly resetAt: number;
};

export const createInMemoryRateLimiter = (
  maxRequests: number,
  windowMs: number,
): RateLimiter => {
  const windows = new Map<string, WindowEntry>();

  const cleanup = (): void => {
    const now = Date.now();
    windows.forEach((entry, key) => {
      if (entry.resetAt <= now) {
        windows.delete(key);
      }
    });
  };

  setInterval(cleanup, 60_000);

  return {
    check: (key: string): RateLimitResult => {
      const now = Date.now();
      const existing = windows.get(key);

      if (!existing || existing.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + windowMs });
        return ok({ allowed: true as const });
      }

      if (existing.count >= maxRequests) {
        return err(RateLimitError('Too many requests'));
      }

      windows.set(key, { count: existing.count + 1, resetAt: existing.resetAt });
      return ok({ allowed: true as const });
    },
  };
};
