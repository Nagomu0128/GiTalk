'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useConversationStore } from '@/stores/conversation-store';
import { useAuthStore } from '@/stores/auth-store';

const API = '/api';

export const useConversationApi = (conversationId: string) => {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const setConversation = useConversationStore((s) => s.setConversation);
  const setBranches = useConversationStore((s) => s.setBranches);
  const setNodes = useConversationStore((s) => s.setNodes);

  const getHeaders = useCallback(async () => {
    const token = await user?.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const refetchAll = useCallback(async () => {
    const headers = await getHeaders();
    const [branchesRes, nodesRes] = await Promise.all([
      fetch(`${API}/v1/conversations/${conversationId}/branches`, { headers }),
      fetch(`${API}/v1/conversations/${conversationId}/nodes`, { headers }),
    ]);
    const branchesData = await branchesRes.json();
    const nodesData = await nodesRes.json();
    setBranches(branchesData.data);
    setNodes(nodesData.nodes);
  }, [conversationId, getHeaders, setBranches, setNodes]);

  useEffect(() => {
    const fetchData = async () => {
      const headers = await getHeaders();
      const [convRes, branchesRes, nodesRes] = await Promise.all([
        fetch(`${API}/v1/conversations/${conversationId}`, { headers }),
        fetch(`${API}/v1/conversations/${conversationId}/branches`, { headers }),
        fetch(`${API}/v1/conversations/${conversationId}/nodes`, { headers }),
      ]);
      if (!convRes.ok) {
        console.error('Failed to load conversation:', convRes.status);
        router.push('/dashboard');
        return;
      }
      const convData = await convRes.json();
      const branchesData = await branchesRes.json();
      const nodesData = await nodesRes.json();
      setConversation({ id: convData.id, title: convData.title, activeBranchId: convData.activeBranchId, contextMode: convData.contextMode });
      setBranches(branchesData.data);
      setNodes(nodesData.nodes);
    };
    fetchData();
  }, [conversationId, getHeaders, router, setBranches, setConversation, setNodes]);

  return { getHeaders, refetchAll };
};
