'use client';

import { useRouter } from 'next/navigation';

type ConversationCardProps = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
};

const formatRelativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  return new Date(iso).toLocaleDateString('ja-JP');
};

export function ConversationCard({ id, title, updatedAt }: ConversationCardProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/conversation/${id}`)}
      className="w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <h3 className="mb-2 truncate text-sm font-medium text-gray-900">{title}</h3>
      <p className="text-xs text-gray-400">{formatRelativeTime(updatedAt)}</p>
    </button>
  );
}
