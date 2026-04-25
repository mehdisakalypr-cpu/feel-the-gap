import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Free Import / Export Tools — EORI, HS Code & more',
  description: 'Free tools for global trade operators. Validate EORI numbers, decode HS codes, calculate tariffs. Built by Feel The Gap.',
  alternates: { canonical: 'https://www.gapup.io/tools' },
}

interface Tool {
  href: string
  title: string
  pitch: string
  status: 'live' | 'coming-soon'
}

const TOOLS: Tool[] = [
  {
    href: '/tools/eori',
    title: 'EORI Number Validator',
    pitch: 'Check the format of your EORI for any EU country plus the UK in seconds.',
    status: 'live',
  },
  {
    href: '/tools/hs-code',
    title: 'HS Code Lookup',
    pitch: 'Decode a Harmonized System code into product description and chapter context.',
    status: 'coming-soon',
  },
  {
    href: '/tools/tariff',
    title: 'Tariff Calculator',
    pitch: 'Estimate import duties for a HS code into any major destination market.',
    status: 'coming-soon',
  },
]

export default function ToolsIndexPage() {
  return (
    <main className="min-h-screen bg-[#07090F] text-white pb-20">
      <div className="mx-auto max-w-5xl px-5 pt-16">
        <p className="text-xs uppercase tracking-[0.18em] text-[#C9A84C] mb-3">Free for operators</p>
        <h1 className="text-4xl md:text-5xl font-serif leading-tight mb-4">
          Import / Export Tools
        </h1>
        <p className="text-base md:text-lg text-white/70 mb-12 max-w-2xl">
          Single-purpose tools to remove the friction in your daily compliance work.
          No signup for the answer — drop your email to receive the printable report.
        </p>

        <ul className="grid gap-5 md:grid-cols-2">
          {TOOLS.map((tool) => {
            const isLive = tool.status === 'live'
            const Inner = (
              <div className={`h-full rounded-xl border ${isLive ? 'border-white/10 hover:border-[#C9A84C]/40' : 'border-white/5'} bg-white/[0.03] p-6 transition`}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold">{tool.title}</h2>
                  {!isLive && (
                    <span className="text-[10px] uppercase tracking-wider rounded-full border border-white/15 px-2 py-0.5 text-white/50">
                      coming soon
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/60">{tool.pitch}</p>
                {isLive && (
                  <p className="mt-4 text-xs font-semibold text-[#C9A84C]">Open tool →</p>
                )}
              </div>
            )
            return (
              <li key={tool.href}>
                {isLive ? <Link href={tool.href}>{Inner}</Link> : Inner}
              </li>
            )
          })}
        </ul>

        <section className="mt-16 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-[#C9A84C] mb-2">Beyond the tools</p>
          <h2 className="text-2xl font-serif mb-3">
            Find your next import / export opportunity in 195 countries
          </h2>
          <p className="text-sm text-white/70 mb-5 max-w-2xl">
            Feel The Gap analyses bilateral trade flows daily and surfaces the gaps where
            your product would meet under-served demand — with country-specific business
            plans, distributor lists and tariff data baked in.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-[#C9A84C] px-6 py-3 text-sm font-semibold text-black hover:bg-[#d8b864] transition"
          >
            See the full Feel The Gap experience →
          </Link>
        </section>
      </div>
    </main>
  )
}
