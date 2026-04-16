import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Formation — Feel The Gap' }

type CropRow = {
  slug: string
  crop_name_fr: string | null
  crop_name: string
  family: string | null
  difficulty: number
  duration_days: number
  short_pitch: string | null
  hero_image_url: string | null
}

export default async function FormationIndex() {
  const sb = await createSupabaseServer()
  const { data: crops } = await sb
    .from('crop_tutorials')
    .select('slug, crop_name_fr, crop_name, family, difficulty, duration_days, short_pitch, hero_image_url')
    .order('difficulty')
    .order('crop_name_fr')

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="text-xs uppercase tracking-[.3em] text-[#C9A84C] mb-2">Formation · Production locale</div>
          <h1 className="text-4xl font-bold mb-3">Maîtrise ta culture avant de vendre</h1>
          <p className="text-gray-400 max-w-2xl">
            Chaque denrée = un tutoriel de 12 étapes (plein champ ou serre). Complète le tutoriel et le quiz pour débloquer les <strong className="text-white">acheteurs potentiels</strong> correspondants.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(crops as CropRow[] | null)?.map((c) => (
            <Link
              key={c.slug}
              href={`/formation/${c.slug}`}
              className="group block rounded-2xl bg-[#0D1117] border border-[rgba(201,168,76,.15)] p-5 hover:border-[#C9A84C] transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500">{c.family}</div>
                  <h2 className="text-lg font-bold group-hover:text-[#C9A84C] transition-colors">{c.crop_name_fr || c.crop_name}</h2>
                </div>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < c.difficulty ? 'bg-[#C9A84C]' : 'bg-white/10'}`} />
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-400 mb-3 line-clamp-2">{c.short_pitch}</p>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>⏱ {c.duration_days}j cycle</span>
                <span className="ml-auto text-[#C9A84C] font-semibold group-hover:translate-x-1 transition-transform">Commencer →</span>
              </div>
            </Link>
          ))}
        </div>

        {(!crops || crops.length === 0) && (
          <div className="text-center text-gray-500 italic py-10">Aucun tutoriel disponible — l&apos;agent de curriculum est en cours.</div>
        )}
      </div>
    </div>
  )
}
