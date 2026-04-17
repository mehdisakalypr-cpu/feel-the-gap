import Link from 'next/link'
import JourneyChipsBar from '@/components/JourneyChipsBar'
import JourneyNavFooter from '@/components/JourneyNavFooter'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ iso: string }> }

const TEMPLATES = [
  { id: 'artisan',  label: 'Artisan',        icon: '🛠️', desc: 'Savoir-faire manuel, petites séries, histoire du produit.' },
  { id: 'food',     label: 'Alimentaire',    icon: '🥗', desc: 'Producteurs, transformateurs, boulangers, épiciers fins.' },
  { id: 'textile',  label: 'Textile & mode', icon: '👕', desc: 'Tissu, confection, accessoires, marques DTC.' },
  { id: 'agri',     label: 'Agriculture',    icon: '🌾', desc: 'Productions végétales, coopératives, filières bio.' },
  { id: 'joaillerie', label: 'Joaillerie & beauté', icon: '💎', desc: 'Pièces uniques, cosmétiques artisanaux, parfums.' },
]

const STEPS = [
  { title: 'Choisis un template', desc: 'Adapté à ton secteur — photo, typo, couleurs pré-calibrées pour convertir.', icon: '1️⃣' },
  { title: 'Importe tes produits', desc: 'CSV, copier-coller, ou auto-import depuis ton catalogue FTG existant.',     icon: '2️⃣' },
  { title: 'Ton site est en ligne', desc: 'URL publique ftg.biz/shop/[ton-nom], Stripe wired, WhatsApp bouton commander.', icon: '3️⃣' },
]

export default async function StoreOnboardingPage({ params }: Props) {
  const { iso } = await params
  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Chips bar — active product context, scroll-sticky. */}
        <JourneyChipsBar className="mb-4" />
        <Link href={`/country/${iso}`} className="text-[#C9A84C] text-sm hover:underline mb-4 inline-block">← Fiche pays</Link>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🏪</span>
          <h1 className="text-3xl md:text-4xl font-bold">Votre site e-commerce en 5 min</h1>
        </div>
        <p className="text-gray-400 text-sm mb-8 max-w-2xl">
          Un mini-site marchand prêt à vendre, sous votre nom ou votre marque. Paiement Stripe / mobile money intégré,
          WhatsApp commande, transport Incoterms auto. Vous gardez 100% de vos ventes, commission plateforme 3%.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {STEPS.map(s => (
            <div key={s.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-2xl mb-2">{s.icon}</p>
              <p className="font-semibold mb-1">{s.title}</p>
              <p className="text-xs text-gray-400">{s.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-semibold mb-4">Choisissez votre template</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          {TEMPLATES.map(t => (
            <Link
              key={t.id}
              href={`/store/new?template=${t.id}&country=${iso.toUpperCase()}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-[#C9A84C]/50 transition"
            >
              <p className="text-2xl mb-2">{t.icon}</p>
              <p className="font-semibold">{t.label}</p>
              <p className="text-xs text-gray-400 mt-1">{t.desc}</p>
            </Link>
          ))}
        </div>

        <div className="p-6 rounded-2xl border border-[#C9A84C]/30 bg-[#C9A84C]/5">
          <p className="text-sm text-[#C9A84C] font-semibold mb-1">Premium feature — incluse dans ton plan 149€/mo</p>
          <p className="text-sm text-gray-300 mb-3">
            1 site = 1 opportunité activée. Tu peux relancer un nouveau site pour chaque pays × produit.
          </p>
          <p className="text-xs text-gray-500">
            Besoin d'un domaine custom (<span className="text-gray-300">tonnom.com</span>) ? +3€/mo en option depuis le dashboard.
          </p>
        </div>

        <JourneyNavFooter currentStepId="store" iso={iso} />
      </div>
    </div>
  )
}
