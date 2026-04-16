import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

type Tutorial = {
  id: string
  slug: string
  crop_name_fr: string | null
  crop_name: string
  family: string | null
  difficulty: number
  duration_days: number
  short_pitch: string | null
}
type Mode = {
  id: string
  mode: 'terrain' | 'serre'
  yield_kg_ha: number | null
  cost_eur_ha: number | null
  roi_pct: number | null
  water_need_m3_ha: number | null
  description_md: string | null
}

export default async function CropPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sb = await createSupabaseServer()

  const { data: t } = await sb.from('crop_tutorials').select('*').eq('slug', slug).maybeSingle()
  if (!t) notFound()
  const tutorial = t as Tutorial

  const { data: modes } = await sb
    .from('crop_tutorial_modes')
    .select('id, mode, yield_kg_ha, cost_eur_ha, roi_pct, water_need_m3_ha, description_md')
    .eq('tutorial_id', tutorial.id)
    .order('mode', { ascending: true })

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/formation" className="text-sm text-gray-500 hover:text-[#C9A84C]">← Toutes les cultures</Link>

        <div className="mt-4 mb-10">
          <div className="text-xs uppercase tracking-[.3em] text-[#C9A84C] mb-2">{tutorial.family}</div>
          <h1 className="text-4xl font-bold mb-3">{tutorial.crop_name_fr || tutorial.crop_name}</h1>
          <p className="text-gray-400 max-w-2xl">{tutorial.short_pitch}</p>
          <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
            <span>Difficulté : {Array.from({ length: tutorial.difficulty }).map(() => '●').join('')}</span>
            <span>Cycle : {tutorial.duration_days}j</span>
          </div>
        </div>

        <div className="mb-6 p-4 bg-[#C9A84C]/5 border border-[#C9A84C]/30 rounded-xl">
          <div className="text-xs uppercase tracking-wider text-[#C9A84C] font-semibold mb-1">🔒 Parcours verrouillé</div>
          <p className="text-sm text-gray-300">Complète le tutoriel ci-dessous (12 étapes + quiz 80%+) pour débloquer les acheteurs potentiels de <strong>{tutorial.crop_name_fr}</strong>.</p>
        </div>

        <h2 className="text-xl font-bold mb-4">Choisis ton mode de production</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {(modes as Mode[] | null)?.map((m) => {
            const isTerrain = m.mode === 'terrain'
            return (
              <Link
                key={m.id}
                href={`/formation/${slug}/${m.mode}`}
                className={`block rounded-2xl p-6 border transition-colors ${isTerrain ? 'bg-[#0D1117] border-[rgba(201,168,76,.15)] hover:border-[#C9A84C]' : 'bg-[#0D1117] border-[rgba(52,211,153,.15)] hover:border-[#34D399]'}`}
              >
                <div className={`text-xs uppercase tracking-wider font-semibold mb-2 ${isTerrain ? 'text-[#C9A84C]' : 'text-[#34D399]'}`}>
                  {isTerrain ? '🌾 Plein champ · Terrain naturel' : '🏡 Serre · Terre protégée'}
                </div>
                <h3 className="text-2xl font-bold mb-3">{isTerrain ? 'Terrain' : 'Serre'}</h3>
                <p className="text-sm text-gray-400 mb-4">{m.description_md || (isTerrain ? 'Production traditionnelle en pleine terre, sans serre — conditions naturelles.' : 'Production en environnement contrôlé, rendements supérieurs, cycles multipliés.')}</p>
                <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                  {m.yield_kg_ha && <Stat label="Rendement" value={`${m.yield_kg_ha.toLocaleString('fr-FR')} kg/ha`} />}
                  {m.cost_eur_ha && <Stat label="Coût" value={`€${m.cost_eur_ha.toLocaleString('fr-FR')}/ha`} />}
                  {m.roi_pct && <Stat label="ROI" value={`${m.roi_pct}%`} />}
                  {m.water_need_m3_ha && <Stat label="Eau" value={`${m.water_need_m3_ha.toLocaleString('fr-FR')} m³/ha`} />}
                </div>
                <div className={`text-sm font-semibold ${isTerrain ? 'text-[#C9A84C]' : 'text-[#34D399]'}`}>Commencer le tutoriel →</div>
              </Link>
            )
          })}
        </div>
        {(!modes || modes.length === 0) && (
          <div className="text-center text-gray-500 italic py-10">Modalités en cours de génération…</div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="font-semibold text-white">{value}</div>
    </div>
  )
}
