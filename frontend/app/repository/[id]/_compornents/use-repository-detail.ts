'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import type { Repository, RepoBranch } from './types';

const API = '/api';

export const useRepositoryDetail = () => {
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
  const [cloneOpen, setCloneOpen] = useState(false);

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

  return {
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
  };
};
