import Link from 'next/link'
import { redirect } from 'next/navigation'
import Topbar from '@/components/Topbar'
import { createSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Acheteurs potentiels — Feel The Gap' }

export default async function LeadsIndex({ searchParams }: { searchParams: Promise<{ country?: string; crop?: string }> }) {
  const { country, crop } = await searchParams
  if (crop) redirect(`/leads/${crop}`)

  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect(`/auth/login?next=/leads${country ? `?country=${country}` : ''}`)

  // Crops the user has completed the tutorial for
  const { data: completions } = await sb
    .from('crop_tutorial_progress')
    .select('mode_id, completed_at, crop_tutorial_modes!inner(tutorial_id, crop_tutorials!inner(slug, crop_name_fr))')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)

  type CropCompletion = { crop_tutorial_modes: { crop_tutorials: { slug: string; crop_name_fr: string } } }
  const uniqueCrops = Array.from(
    new Map(
      ((completions ?? []) as unknown as CropCompletion[]).map((c) => [
        c.crop_tutorial_modes.crop_tutorials.slug,
        c.crop_tutorial_modes.crop_tutorials,
      ]),
    ).values(),
  )

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <Topbar />
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-xs uppercase tracking-[.3em] text-[#C9A84C] mb-3">Acheteurs potentiels</div>
        <h1 className="text-4xl font-bold mb-3">Choisis la denrée{country ? <> · marché <span className="text-[#C9A84C]">{country.toUpperCase()}</span></> : null}</h1>
        <p className="text-gray-400 mb-10">
          Les fichiers d&apos;acheteurs sont débloqués denrée par denrée, après complétion du tutoriel de production (terrain ou serre).
        </p>

        {uniqueCrops.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-3">
            {uniqueCrops.map((c) => (
              <Link
                key={c.slug}
                href={`/leads/${c.slug}${country ? `?country=${country}` : ''}`}
                className="block bg-[#0D1117] border border-emerald-400/30 rounded-xl p-4 hover:border-emerald-400 transition-colors"
              >
                <div className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1">✓ Débloqué</div>
                <div className="font-bold text-white">{c.crop_name_fr}</div>
                <div className="text-xs text-[#C9A84C] mt-2">Voir les acheteurs →</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-[#0D1117] border border-[#C9A84C]/30 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-xl font-bold mb-2">Aucune denrée débloquée</h2>
            <p className="text-sm text-gray-400 mb-6">
              Commence par suivre un tutoriel de production pour débloquer les fichiers acheteurs correspondants.
            </p>
            <Link
              href="/formation"
              className="inline-block px-6 py-3 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors"
            >
              Voir les formations →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
