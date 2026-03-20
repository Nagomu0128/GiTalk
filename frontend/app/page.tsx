import Image from 'next/image';
import Link from 'next/link';

const FEATURES = [
  {
    image: '/light_mode_branch_image.png',
    title: '分岐する',
    description: '会話を好きなだけ枝分かれさせて並行探索',
  },
  {
    image: '/light_mode_merge_image.png',
    title: '統合する',
    description: 'ブランチの結論を一つにまとめる',
  },
  {
    image: '/light_mode_box_image.png',
    title: '保存する',
    description: 'リポジトリとして構造ごと保存',
    size: 72,
  },
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Image src="/light_mode_logo.png" alt="GiTalk" width={28} height={28} />
          <span className="text-xl font-bold text-gray-900">GiTalk</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            ログイン
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            はじめる
          </Link>
        </div>
      </header>

      {/* ヒーロー */}
      <section className="flex flex-col items-center px-6 py-24 text-center">
        <div className="mb-6">
          <Image src="/light_mode_logo.png" alt="GiTalk" width={120} height={120} />
        </div>
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          AIとの会話を、もっと構造的に。
        </h1>
        <p className="mb-10 max-w-md text-base text-gray-500">
          会話を分岐し、管理し、共有する。
          <br />
          Git × AI Chat の新しい体験。
        </p>
        <Link
          href="/login"
          className="rounded-full bg-gray-900 px-8 py-3 text-base font-medium text-white hover:bg-gray-700"
        >
          会話を始める →
        </Link>
      </section>

      {/* 機能紹介 */}
      <section className="border-t bg-gray-50 px-6 py-16">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-24 w-24 items-center justify-center">
                <Image
                  src={feature.image}
                  alt={feature.title}
                  width={'size' in feature ? feature.size : 96}
                  height={'size' in feature ? feature.size : 96}
                  className="object-contain"
                  unoptimized
                />
              </div>
              <h3 className="mb-2 text-base font-semibold text-gray-900">{feature.title}</h3>
              <p className="text-sm text-gray-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* フッター */}
      <footer className="border-t px-6 py-6 text-center text-xs text-gray-400">
        © 2026 GiTalk
      </footer>
    </div>
  );
}
