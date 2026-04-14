import Link from 'next/link'

const CARDS = [
  { href: '/legal/cgv',     title: 'Terms of Sale (CGV)',       sub: 'Data / Strategy / Premium plans, pricing, delivery, withdrawal' },
  { href: '/legal/cgu',     title: 'Terms of Use (CGU)',        sub: 'Platform use, AI Output, arbitration, governing law' },
  { href: '/legal/privacy', title: 'Privacy Policy',            sub: 'GDPR / CCPA / LGPD / POPIA / NDPR / DPDP compliance' },
  { href: '/legal/cookies', title: 'Cookie Policy',             sub: 'CNIL-compliant consent, GPC support' },
  { href: '/legal/aup',     title: 'Acceptable Use Policy',     sub: 'Prohibited content, scraping limits, fair-use caps' },
  { href: '/legal/dmca',    title: 'DMCA & Copyright',          sub: 'Copyright infringement + EU DSA notice' },
  { href: '/legal/refund',  title: 'Refund & Cancellation',     sub: '14-day cooling-off + annual prepay logic' },
  { href: '/legal/dpa',     title: 'Data Processing Agreement', sub: 'GDPR Art. 28 DPA (auto-concluded B2B)' },
  { href: '/legal/subprocessors', title: 'Subprocessors',       sub: 'Vendors processing personal data on our behalf' },
]

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sky-400 text-sm hover:underline mb-8 block">← Home</Link>
        <h1 className="text-2xl font-bold mb-2">Legal & Compliance</h1>
        <p className="text-sm text-slate-400 mb-8">
          Feel The Gap is a product of OFA Holdings LLC, a Wyoming limited liability company.
          Documents are bilingual (English / Français). Current versions dated April 2026.
        </p>
        <div className="space-y-3">
          {CARDS.map(c => (
            <Link key={c.href} href={c.href} className="block p-4 border border-white/10 rounded-xl hover:border-sky-500/40 transition-colors">
              <h2 className="font-bold">{c.title}</h2>
              <p className="text-sm text-slate-400 mt-1">{c.sub}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
