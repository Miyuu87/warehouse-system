import Link from 'next/link'

const tools = [
  {
    href: '/shopify-sync',
    title: 'Shopify同期管理',
    description: '公開状態・予約・SKU重複エラー・同期実行を管理',
  },
  {
    href: '/stock-watch',
    title: '在庫監視',
    description: 'カラーミーの商品在庫を確認',
  },
  {
    href: '/sagefuda-generator',
    title: '下げ札作成',
    description: '商品データから下げ札を作成',
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f3ee] px-6 py-16 text-[#171717]">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 text-xs font-semibold tracking-[0.22em] text-[#747067]">
          YOU ARE MY POISON
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Warehouse System</h1>
        <p className="mt-3 text-[#625f58]">商品・在庫・外部ストア連携の管理ページです。</p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h2 className="text-xl font-semibold">{tool.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#68645d]">{tool.description}</p>
              <span className="mt-6 inline-block text-sm font-semibold">開く →</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
