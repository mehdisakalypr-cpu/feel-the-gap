import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Boutique e-commerce clé en main — Feel The Gap' }

export default async function ShopCreatePage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const { country } = await searchParams
  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-xs uppercase tracking-[.3em] text-[#34D399] mb-3">🛒 Boutique e-commerce · Optionnel</div>
        <h1 className="text-4xl font-bold mb-4">Ta boutique en ligne clé en main</h1>
        <p className="text-gray-400 mb-10">
          Une fois ton business plan validé et ta formation complétée, on te déploie une boutique e-commerce
          {country ? <> sur le marché <strong className="text-white">{country.toUpperCase()}</strong></> : null}{' '}
          en 48h : design, paiement local (mobile money + carte), logistique, tracking.
        </p>

        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {[
            { icon: '🎨', t: 'Design sur mesure', d: 'Template adapté à ta denrée + archétype identitaire (artisan / moderne / luxe)' },
            { icon: '💳', t: 'Paiement localisé', d: 'Mobile money (MoMo, Orange Money, Wave, Flutterwave) + carte + crypto stablecoin' },
            { icon: '📦', t: 'Logistique intégrée', d: 'Incoterms FOB/CIF auto + corridors transport + traçabilité' },
          ].map(c => (
            <div key={c.t} className="bg-[#0D1117] border border-white/10 rounded-xl p-5">
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="font-semibold mb-1">{c.t}</div>
              <div className="text-xs text-gray-500">{c.d}</div>
            </div>
          ))}
        </div>

        <div className="bg-[#C9A84C]/5 border border-[#C9A84C]/30 rounded-2xl p-6 mb-6">
          <div className="text-xs uppercase tracking-wider text-[#C9A84C] font-semibold mb-2">🔒 Pré-requis</div>
          <ol className="text-sm text-gray-300 space-y-1">
            <li>1. Business plan complété (onglet Opportunités → "Business plan")</li>
            <li>2. Formation de production suivie (terrain ou serre)</li>
            <li>3. Fichier clients débloqué (leads ciblés obtenus)</li>
          </ol>
        </div>

        <div className="flex items-center gap-3">
          <Link href={country ? `/country/${country}` : '/map'} className="text-sm text-gray-500 hover:text-white">
            ← Retour au pays
          </Link>
          <button className="ml-auto px-6 py-3 bg-[#34D399] text-[#07090F] font-bold rounded-xl hover:bg-emerald-400 transition-colors" disabled>
            Lancer ma boutique (bientôt)
          </button>
        </div>

        <p className="text-xs text-gray-600 text-center mt-8">
          Feature en développement · Disponibilité Q3 2026 · <Link href="/contact" className="text-[#C9A84C] hover:underline">Rejoindre la liste d&apos;attente</Link>
        </p>
      </div>
    </div>
  )
}
