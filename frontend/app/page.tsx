import Link from 'next/link';

const FEATURES = [
  { icon: '🌿', title: '分岐する', description: '会話を好きなだけ枝分かれさせて並行探索' },
  { icon: '🔀', title: '統合する', description: 'ブランチの結論を一つにまとめる' },
  { icon: '📦', title: '保存する', description: 'リポジトリとして構造ごと保存' },
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-xl font-bold text-gray-900">GiTalk</span>
        <div className="flex gap-3">
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
            ログイン
          </Link>
          <Link href="/login" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
            はじめる →
          </Link>
        </div>
      </header>

      {/* ヒーロー */}
      <section className="flex flex-col items-center px-6 py-24 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          AIとの会話を、もっと構造的に。
        </h1>
        <p className="mb-8 max-w-md text-lg text-gray-500">
          会話を分岐し、管理し、共有する。
          <br />
          Git × AI Chat の新しい体験。
        </p>
        <Link
          href="/login"
          className="rounded-xl bg-blue-600 px-8 py-3 text-base font-medium text-white shadow-lg transition-transform hover:scale-105 hover:bg-blue-700"
        >
          無料ではじめる →
        </Link>
      </section>

      {/* 機能紹介 */}
      <section className="border-t bg-gray-50 px-6 py-16">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="text-center">
              <div className="mb-3 text-3xl">{feature.icon}</div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">{feature.title}</h3>
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
