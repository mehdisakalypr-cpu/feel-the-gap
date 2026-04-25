import type { Metadata } from 'next'
import EoriValidatorForm from '@/components/tools/EoriValidatorForm'

export const metadata: Metadata = {
  title: 'Free EORI Number Validator — Check format for FR, GB, DE, ES & more',
  description: 'Instantly validate your EORI (Economic Operator Registration & Identification) number format for any EU country plus the UK. Free tool, no signup required for the format check.',
  alternates: { canonical: 'https://www.gapup.io/tools/eori' },
  openGraph: {
    title: 'EORI Number Validator — Free import/export compliance check',
    description: 'Check your EORI format in seconds. Required for any EU import or export shipment.',
    type: 'website',
  },
}

export default function EoriToolPage() {
  return (
    <main className="min-h-screen bg-[#07090F] text-white pb-20">
      <div className="mx-auto max-w-3xl px-5 pt-16">
        <p className="text-xs uppercase tracking-[0.18em] text-[#C9A84C] mb-3">Free import/export tool</p>
        <h1 className="text-4xl md:text-5xl font-serif leading-tight mb-4">
          EORI Number Validator
        </h1>
        <p className="text-base md:text-lg text-white/70 mb-8 max-w-2xl">
          Check your EORI (Economic Operator Registration & Identification) number format
          for any EU country plus the UK. Required for every shipment crossing EU customs.
        </p>

        <EoriValidatorForm />

        <section className="mt-16 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-sm font-semibold text-[#C9A84C] mb-2">What is an EORI number?</h2>
            <p className="text-sm text-white/70">
              EORI is the unique ID assigned by national customs authorities to any business
              moving goods in or out of the EU. Without a valid EORI, your shipment can be
              held at the border. Each country has its own format.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-sm font-semibold text-[#C9A84C] mb-2">Why this matters for your trade</h2>
            <p className="text-sm text-white/70">
              A wrong EORI = blocked shipment, fines, lost margin. Feel The Gap helps
              import/export operators identify gaps in 195 countries and avoid the
              compliance traps that kill deals.
            </p>
          </div>
        </section>

        <section className="mt-12 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-[#C9A84C] px-6 py-3 text-sm font-semibold text-black hover:bg-[#d8b864] transition"
          >
            See how Feel The Gap finds your next opportunity →
          </a>
        </section>
      </div>
    </main>
  )
}
