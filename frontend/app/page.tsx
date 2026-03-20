'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useThemeImage } from '@/hooks/use-theme-image';

const FEATURE_KEYS = ['branch', 'merge', 'box'] as const;
const FEATURE_DATA = [
  { key: 'branch' as const, title: '分岐する', description: '会話を好きなだけ枝分かれさせて並行探索', size: 96 },
  { key: 'merge' as const, title: '統合する', description: 'ブランチの結論を一つにまとめる', size: 96 },
  { key: 'box' as const, title: '保存する', description: 'リポジトリとして構造ごと保存', size: 72 },
] as const;

const FeatureCard = ({ featureKey, title, description, size }: { readonly featureKey: typeof FEATURE_KEYS[number]; readonly title: string; readonly description: string; readonly size: number }) => {
  const src = useThemeImage(featureKey);
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 flex h-24 w-24 items-center justify-center">
        <Image src={src} alt={title} width={size} height={size} className="object-contain" unoptimized />
      </div>
      <h3 className="mb-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
      <p className="text-sm text-neutral-500">{description}</p>
    </div>
  );
};

export default function LandingPage() {
  const logoSrc = useThemeImage('logo');
  const logoCircleSrc = useThemeImage('logo_with_circle');

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Image src={logoCircleSrc} alt="GiTalk" width={48} height={48} />
          <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">GiTalk</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
            ログイン
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            はじめる
          </Link>
        </div>
      </header>

      {/* ヒーロー */}
      <section className="flex flex-col items-center px-6 py-24 text-center">
        <div className="mb-6">
          <Image src={logoSrc} alt="GiTalk" width={130} height={130} />
        </div>
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl dark:text-neutral-100">
          AIとの会話を、もっと構造的に。
        </h1>
        <p className="mb-10 max-w-md text-base text-neutral-500">
          会話を分岐し、管理し、共有する。
          <br />
          Git × AI Chat の新しい体験。
        </p>
        <Link
          href="/login"
          className="rounded-full bg-neutral-900 px-8 py-3 text-base font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          会話を始める →
        </Link>
      </section>

      {/* 機能紹介 */}
      <section className="border-t border-neutral-200 bg-neutral-50 px-6 py-8 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
          {FEATURE_DATA.map((feature) => (
            <FeatureCard key={feature.key} featureKey={feature.key} title={feature.title} description={feature.description} size={feature.size} />
          ))}
        </div>
      </section>

      {/* フッター */}
      <footer className="border-t border-neutral-200 px-6 py-4 text-center text-xs text-neutral-400 dark:border-neutral-800">
        © 2026 GiTalk
      </footer>
    </div>
  );
}
