'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Search, ArrowLeft, GitBranch, Copy, Sun, Moon, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { signOut } from 'firebase/auth';
import { useAuthStore } from '@/stores/auth-store';
import { getFirebaseAuth } from '@/lib/firebase';
import { MessageBubble } from '@/components/chat/message-bubble';
import { RepoSearchDialog } from '@/components/dialogs/repo-search-dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const API = '/api';

type Repository = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly visibility: 'private' | 'public';
};

type RepoNode = {
  readonly id: string;
  readonly parentRepositoryNodeId: string | null;
  readonly nodeType: string;
  readonly userMessage: string;
  readonly aiResponse: string;
  readonly model: string;
  readonly originalCreatedAt: string;
};

type RepoBranch = {
  readonly repository_branch_id: string;
  readonly name: string;
  readonly nodes: ReadonlyArray<RepoNode>;
};

// --- Header Component ---

const Header = ({
  title,
  visibility,
  description,
  onBack,
  onClone,
}: {
  readonly title: string;
  readonly visibility: 'private' | 'public';
  readonly description: string | null;
  readonly onBack: () => void;
  readonly onClone: () => void;
}) => (
  <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-300 px-4 dark:border-neutral-700">
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-neutral-800 transition-colors hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-neutral-100"
      >
        <ArrowLeft size={16} />
        <span>リポジトリ一覧</span>
      </button>
      <span className="text-neutral-300 dark:text-neutral-600">|</span>
      <span className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">{title}</span>
      <span className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 dark:border-neutral-600 dark:text-neutral-400">
        {visibility}
      </span>
      {description && (
        <>
          <span className="text-neutral-300 dark:text-neutral-600">|</span>
          <span className="truncate text-xs text-neutral-500">{description}</span>
        </>
      )}
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={onClone}
        className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      >
        <Copy size={13} />
        <span>コピーして使う</span>
      </button>
    </div>
  </header>
);

// --- Page Component ---

export default function RepositoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const repoId = params.id as string;
  const user = useAuthStore((s) => s.user);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [repo, setRepo] = useState<Repository | null>(null);
  const [branches, setBranches] = useState<ReadonlyArray<RepoBranch>>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const fetchData = async () => {
      const token = await user?.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [repoRes, nodesRes] = await Promise.all([
        fetch(`${API}/v1/repositories/${repoId}`, { headers }),
        fetch(`${API}/v1/repositories/${repoId}/nodes`, { headers }),
      ]);

      if (!repoRes.ok) { router.push('/dashboard/repositories'); return; }

      const repoData = await repoRes.json();
      setRepo(repoData);

      if (nodesRes.ok) {
        const nodesData = await nodesRes.json();
        setBranches(nodesData.branches);
        if (nodesData.branches.length > 0) {
          setSelectedBranch(nodesData.branches[0].repository_branch_id);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [repoId, user, router]);

  const selectedBranchData = branches.find((b) => b.repository_branch_id === selectedBranch);

  // Scroll to top when branch changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedBranch]);

  const handleBack = useCallback(() => {
    router.push('/dashboard/repositories');
  }, [router]);

  const handleSearchNavigate = useCallback((branchId: string, nodeId: string) => {
    setSelectedBranch(branchId);
    setTimeout(() => {
      const el = document.getElementById(`repo-node-${nodeId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, []);

  const [cloneDialog, setCloneDialog] = useState(false);
  const [cloneSelectedBranches, setCloneSelectedBranches] = useState<Set<string>>(new Set());
  const [cloneLoading, setCloneLoading] = useState(false);

  // Init clone branch selection with all branches
  const openCloneDialog = () => {
    setCloneSelectedBranches(new Set(branches.map((b) => b.repository_branch_id)));
    setCloneDialog(true);
  };

  const toggleCloneBranch = (branchId: string) => {
    setCloneSelectedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  };

  const handleCloneConfirm = async () => {
    setCloneLoading(true);
    const token = await user?.getIdToken();
    const res = await fetch(`${API}/v1/repositories/${repoId}/clone`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_ids: [...cloneSelectedBranches] }),
    });
    setCloneLoading(false);
    if (res.ok) {
      const data = await res.json();
      setCloneDialog(false);
      router.push(`/conversation/${data.conversationId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-neutral-100 dark:bg-neutral-900">
        <div className="text-neutral-500 dark:text-neutral-400">読み込み中...</div>
      </div>
    );
  }

  if (!repo) return null;

  return (
    <div className="flex h-screen w-full bg-neutral-100 dark:bg-neutral-900">
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header
          title={repo.title}
          visibility={repo.visibility}
          description={repo.description}
          onBack={handleBack}
          onClone={openCloneDialog}
        />

        {/* Split view: branch list + conversation */}
        <div className="flex flex-1 overflow-hidden">
          {/* Branch list panel */}
          <div className="flex w-60 shrink-0 flex-col border-r border-neutral-200 dark:border-neutral-700">
            <div className="flex h-10 shrink-0 items-center justify-between px-4">
              <span className="text-xs font-medium text-neutral-500">ブランチ</span>
              <button
                onClick={() => setSearchOpen(true)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
              >
                <Search size={13} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {branches.length === 0 && (
                <p className="px-2 text-xs text-neutral-500">まだブランチがpushされていません</p>
              )}
              {branches.map((branch) => (
                <button
                  key={branch.repository_branch_id}
                  onClick={() => setSelectedBranch(branch.repository_branch_id)}
                  className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    selectedBranch === branch.repository_branch_id
                      ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
                  }`}
                >
                  <GitBranch size={14} className="shrink-0" />
                  <span className="flex-1 truncate">{branch.name}</span>
                  <span className="shrink-0 text-xs text-neutral-500">{branch.nodes.length}</span>
                </button>
              ))}
            </div>

            {/* Theme toggle */}
            <div className="border-t border-neutral-300 px-2 py-2 dark:border-neutral-700">
              <button
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                {resolvedTheme === 'dark' ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
                <span>{resolvedTheme === 'dark' ? 'ライトモード' : 'ダークモード'}</span>
              </button>
            </div>

            {/* User info */}
            {user && (
              <div className="border-t border-neutral-300 px-2 py-3 dark:border-neutral-700">
                <Popover>
                  <PopoverTrigger
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName ?? ''}
                        className="h-7 w-7 shrink-0 rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                        {(user.displayName ?? user.email ?? '?')[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm text-neutral-800 dark:text-neutral-200">{user.displayName ?? 'User'}</p>
                      <p className="truncate text-xs text-neutral-500">{user.email}</p>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="start"
                    sideOffset={8}
                    className="w-48 !rounded-2xl border-neutral-200 bg-white p-1 dark:border-neutral-600 dark:bg-neutral-800"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 !rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-neutral-700 dark:hover:text-red-300"
                      onClick={() => signOut(getFirebaseAuth())}
                    >
                      <LogOut size={14} />
                      ログアウト
                    </Button>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Conversation panel */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {!selectedBranchData ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-neutral-500">ブランチを選択してください</p>
              </div>
            ) : selectedBranchData.nodes.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-neutral-500">このブランチにはノードがありません</p>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl px-6 py-6">
                {/* Branch name header */}
                <div className="mb-6 flex items-center gap-2">
                  <GitBranch size={14} className="text-neutral-500" />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{selectedBranchData.name}</span>
                  <span className="text-xs text-neutral-500">({selectedBranchData.nodes.length} nodes)</span>
                </div>

                {/* Messages */}
                {selectedBranchData.nodes.map((node) => (
                  <div key={node.id} id={`repo-node-${node.id}`}>
                    {node.userMessage && (
                      <MessageBubble role="user" content={node.userMessage} timestamp={node.originalCreatedAt} />
                    )}
                    {node.aiResponse && (
                      <MessageBubble role="ai" content={node.aiResponse} model={node.model} timestamp={node.originalCreatedAt} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clone Dialog */}
      {cloneDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
            <h3 className="mb-2 text-base font-bold text-neutral-900 dark:text-neutral-100">この会話をコピーしますか？</h3>
            <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
              選択したブランチの会話を自分の会話としてコピーします。
            </p>

            <div className="mb-5">
              <p className="mb-2 text-xs font-medium text-neutral-500">ブランチ選択</p>
              {branches.map((branch) => (
                <label key={branch.repository_branch_id} className="flex items-center gap-2 py-1 text-sm text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={cloneSelectedBranches.has(branch.repository_branch_id)}
                    onChange={() => toggleCloneBranch(branch.repository_branch_id)}
                    className="rounded border-neutral-300 dark:border-neutral-600"
                  />
                  <GitBranch size={13} className="text-neutral-500" />
                  {branch.name}
                  <span className="text-xs text-neutral-500">({branch.nodes.length} nodes)</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCloneDialog(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                キャンセル
              </button>
              <button
                onClick={handleCloneConfirm}
                disabled={cloneLoading || cloneSelectedBranches.size === 0}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-amber-400 disabled:opacity-50"
              >
                {cloneLoading ? 'コピー中...' : 'コピーして使う'}
              </button>
            </div>
          </div>
        </div>
      )}

      <RepoSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        branches={branches}
        onNavigate={handleSearchNavigate}
      />
    </div>
  );
}
