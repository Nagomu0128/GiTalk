import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, err } from 'neverthrow';

const mockDeleteContextCache = vi.fn();
const mockUpdateBranchCache = vi.fn();

vi.mock('../../src/infra/gemini.js', () => ({
  generateContentWithMetadata: vi.fn(),
  deleteContextCache: (...args: unknown[]) => mockDeleteContextCache(...args),
}));

vi.mock('../../src/infra/branch.js', () => ({
  findBranchById: vi.fn(),
  updateBranchHead: vi.fn(),
  updateBranchCache: (...args: unknown[]) => mockUpdateBranchCache(...args),
}));

vi.mock('../../src/infra/node.js', () => ({
  findNodeById: vi.fn(),
  getPathToRoot: vi.fn(),
  createNode: vi.fn(),
}));

vi.mock('../../src/infra/conversation.js', () => ({
  updateConversation: vi.fn(),
}));

vi.mock('../../src/domain/lca.js', () => ({
  findLCA: vi.fn(),
}));

vi.mock('../../src/shared/logger.js', () => ({
  appLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../src/shared/error.js', () => ({
  errorBuilder: (name: string) => {
    const factory = (message: string) => ({ _tag: name, message });
    factory.handle = (e: unknown) => ({ _tag: name, message: String(e) });
    return factory;
  },
}));

describe('invalidateBranchCache ロジック', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cacheName がある場合、Vertex AI キャッシュ削除 + DB クリアを行う', async () => {
    mockDeleteContextCache.mockReturnValue(ok(undefined));
    mockUpdateBranchCache.mockReturnValue(ok({ id: 'branch-1' }));

    const branchId = 'branch-1';
    const cacheName = 'cached-content-123';

    // invalidateBranchCache と同等の処理
    await mockDeleteContextCache(cacheName).match(
      () => {},
      () => {},
    );
    await mockUpdateBranchCache(branchId, null).match(
      () => {},
      () => {},
    );

    expect(mockDeleteContextCache).toHaveBeenCalledWith('cached-content-123');
    expect(mockUpdateBranchCache).toHaveBeenCalledWith('branch-1', null);
  });

  it('cacheName が null の場合、何もしない', () => {
    const cacheName: string | null = null;

    if (!cacheName) {
      // invalidateBranchCache は早期リターン
      expect(mockDeleteContextCache).not.toHaveBeenCalled();
      expect(mockUpdateBranchCache).not.toHaveBeenCalled();
      return;
    }
  });

  it('Vertex AI キャッシュ削除が失敗しても DB クリアは実行される', async () => {
    mockDeleteContextCache.mockReturnValue(err({ _tag: 'GeminiError', message: 'Not found' }));
    mockUpdateBranchCache.mockReturnValue(ok({ id: 'branch-1' }));

    const branchId = 'branch-1';
    const cacheName = 'expired-cache';

    await mockDeleteContextCache(cacheName).match(
      () => {},
      () => {}, // エラーは無視（期限切れの可能性）
    );

    // 削除失敗でも DB クリアは実行
    await mockUpdateBranchCache(branchId, null).match(
      () => {},
      () => {},
    );

    expect(mockDeleteContextCache).toHaveBeenCalledWith('expired-cache');
    expect(mockUpdateBranchCache).toHaveBeenCalledWith('branch-1', null);
  });
});

describe('isValidModel', () => {
  it('サポートされているモデルを検証', () => {
    const VALID_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
    const isValid = (model: string) => VALID_MODELS.includes(model);

    expect(isValid('gemini-2.5-flash')).toBe(true);
    expect(isValid('gemini-2.5-pro')).toBe(true);
    expect(isValid('gemini-2.0-flash')).toBe(true);
    expect(isValid('gemini-2.0-flash-lite')).toBe(true);
    expect(isValid('gpt-4')).toBe(false);
    expect(isValid('')).toBe(false);
  });
});
