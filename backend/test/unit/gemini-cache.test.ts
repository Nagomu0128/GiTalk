import { describe, it, expect } from 'vitest';
import { shouldUseCache, isCacheValid } from '../../src/infra/gemini.js';

describe('shouldUseCache', () => {
  it('32768 トークン以上で true を返す', () => {
    expect(shouldUseCache(32768)).toBe(true);
    expect(shouldUseCache(50000)).toBe(true);
    expect(shouldUseCache(100000)).toBe(true);
  });

  it('32768 トークン未満で false を返す', () => {
    expect(shouldUseCache(0)).toBe(false);
    expect(shouldUseCache(32767)).toBe(false);
    expect(shouldUseCache(10000)).toBe(false);
  });
});

describe('isCacheValid', () => {
  it('null の場合 false を返す', () => {
    expect(isCacheValid(null)).toBe(false);
  });

  it('作成から1時間以内なら true を返す', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(isCacheValid(fiveMinutesAgo)).toBe(true);
  });

  it('作成から59分なら true を返す', () => {
    const fiftyNineMinutesAgo = new Date(Date.now() - 59 * 60 * 1000);
    expect(isCacheValid(fiftyNineMinutesAgo)).toBe(true);
  });

  it('作成から1時間を超えたら false を返す', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(isCacheValid(twoHoursAgo)).toBe(false);
  });

  it('ちょうど1時間で false を返す（境界値）', () => {
    const exactlyOneHour = new Date(Date.now() - 3600 * 1000);
    expect(isCacheValid(exactlyOneHour)).toBe(false);
  });
});
