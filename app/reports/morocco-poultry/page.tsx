/**
 * /reports/morocco-poultry — page publique d'accès au rapport PDF
 * "Exploitations avicoles ≥ 1M poulets au Maroc". Lien de téléchargement
 * vers /api/reports/morocco-poultry (PDF généré on-demand via jsPDF).
 */
import Link from 'next/link'

export const metadata = {
  title: 'Rapport Maroc — Filière avicole · Feel The Gap',
  description: 'Cartographie des top 5 exploitations avicoles au Maroc avec adresses, capacités et checklist anti-bullshit.',
}

export default function MoroccoPoultryPage() {
  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <header className="border-b border-[rgba(201,168,76,.15)]">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#C9A84C]" />
            <span className="font-bold">Feel <span className="text-[#C9A84C]">The Gap</span></span>
          </Link>
          <span className="text-xs text-gray-500 uppercase tracking-widest">Rapport · Trade Intelligence</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-2 text-xs text-[#C9A84C] uppercase tracking-widest">Maroc · Filière avicole</div>
        <h1 className="text-4xl font-bold mb-4" style={{ fontFamily: 'Georgia, serif' }}>
          Exploitations avicoles <span className="text-[#C9A84C]">≥ 1M poulets</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mb-8">
          Cartographie des 5 opérateurs vérifiés, adresses & villes, capacités publiques, checklist anti-bullshit
          et sources officielles (ONSSA, FISA, EIB, CGEM).
        </p>

        {/* CTA télécharger */}
        <div className="rounded-2xl border border-[#C9A84C]/30 bg-gradient-to-br from-[#C9A84C]/10 to-transparent p-6 mb-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#C9A84C] text-[#07090F] flex items-center justify-center text-xl font-bold shrink-0">
              ↓
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-lg mb-1">Télécharger le PDF</h2>
              <p className="text-sm text-gray-400 mb-4">
                Le rapport complet avec carte des 5 exploitations, tableaux par opérateur et questions à poser.
              </p>
              <a
                href="/api/reports/morocco-poultry"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors text-sm"
                download="ftg-rapport-maroc-aviculture.pdf"
              >
                Télécharger le rapport PDF
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
              </a>
              <p className="text-[11px] text-gray-500 mt-3 font-mono">URL directe: /api/reports/morocco-poultry</p>
            </div>
          </div>
        </div>

        {/* Aperçu contenu */}
        <section className="space-y-4">
          <h3 className="text-sm text-gray-500 uppercase tracking-widest">Ce que contient le rapport</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex gap-3"><span className="text-[#C9A84C]">1.</span> Carte des 5 exploitations (Casablanca, Fès, El Jadida, Had Soualem)</li>
            <li className="flex gap-3"><span className="text-[#C9A84C]">2.</span> Plausibilité "1M poulets" — cheptel vivant vs production annuelle</li>
            <li className="flex gap-3"><span className="text-[#C9A84C]">3.</span> Top 5 opérateurs : Zalar, Koutoubia, Dar El Fellous, ALF Sahel, Matinales (adresses + capacités)</li>
            <li className="flex gap-3"><span className="text-[#C9A84C]">4.</span> Checklist anti-bullshit : 5 questions chiffrées à poser au contact</li>
            <li className="flex gap-3"><span className="text-[#C9A84C]">5.</span> Sources officielles : ONSSA (liste VPABV), FISA, CGEM, EIB</li>
          </ul>
        </section>

        <p className="text-xs text-gray-600 mt-12">
          Rapport généré dynamiquement. Données consolidées à partir de sources publiques vérifiées.
        </p>
      </main>
    </div>
  )
}
