'use client';

import { RepoSearchDialog } from '@/components/dialogs/repo-search-dialog';
import { useRepositoryDetail } from './_compornents/use-repository-detail';
import { RepositoryHeader } from './_compornents/repository-header';
import { BranchListPanel } from './_compornents/branch-list-panel';
import { ConversationPanel } from './_compornents/conversation-panel';
import { CloneDialog } from './_compornents/clone-dialog';

export default function RepositoryDetailPage() {
  const {
    repoId,
    repo,
    branches,
    selectedBranch,
    selectedBranchData,
    loading,
    searchOpen,
    cloneOpen,
    scrollRef,
    setSelectedBranch,
    setSearchOpen,
    setCloneOpen,
    handleBack,
    handleSearchNavigate,
  } = useRepositoryDetail();

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
        <RepositoryHeader
          title={repo.title}
          visibility={repo.visibility}
          description={repo.description}
          onBack={handleBack}
          onClone={() => setCloneOpen(true)}
        />

        <div className="flex flex-1 overflow-hidden">
          <BranchListPanel
            branches={branches}
            selectedBranch={selectedBranch}
            onSelectBranch={setSelectedBranch}
            onSearchOpen={() => setSearchOpen(true)}
          />

          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <ConversationPanel branch={selectedBranchData} />
          </div>
        </div>
      </div>

      <CloneDialog
        repoId={repoId}
        branches={branches}
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
      />

      <RepoSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        branches={branches}
        onNavigate={handleSearchNavigate}
      />
    </div>
  );
}
