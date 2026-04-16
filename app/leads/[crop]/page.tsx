import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function LeadsForCrop({ params }: { params: Promise<{ crop: string }> }) {
  const { crop: cropSlug } = await params
  const sb = await createSupabaseServer()

  // Require auth
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect(`/auth/login?next=/leads/${cropSlug}`)

  // Load crop metadata
  const { data: crop } = await sb
    .from('crop_tutorials')
    .select('id, slug, crop_name_fr, crop_name')
    .eq('slug', cropSlug)
    .maybeSingle()
  if (!crop) notFound()

  // GATE : require tutorial completion
  const { data: gateRow } = await sb.rpc('has_completed_tutorial', { p_user: user.id, p_crop_slug: cropSlug })
  const hasCompleted = gateRow === true

  if (!hasCompleted) {
    return (
      <div className="min-h-screen bg-[#07090F] text-white flex items-center justify-center px-6">
        <div className="max-w-lg w-full bg-[#0D1117] border border-[#C9A84C]/30 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-3">Acheteurs verrouillés</h1>
          <p className="text-gray-400 mb-2">
            Pour voir les acheteurs potentiels de <strong className="text-white">{crop.crop_name_fr}</strong>, complète d&apos;abord le tutoriel de production (terrain ou serre).
          </p>
          <p className="text-xs text-gray-500 mb-8">Cette étape garantit que tu sais produire la denrée avant de t&apos;engager avec un acheteur — et améliore ton positionnement vendeur.</p>

          <div className="flex flex-col gap-3">
            <Link
              href={`/formation/${cropSlug}`}
              className="block px-6 py-3 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A]"
            >
              Commencer la formation →
            </Link>
            <Link href="/formation" className="text-sm text-gray-500 hover:text-[#C9A84C]">Voir toutes les cultures</Link>
          </div>
        </div>
      </div>
    )
  }

  // Load leads matching this crop
  const { data: leads } = await sb
    .from('commerce_leads')
    .select('id, business_name, email, phone, whatsapp, country_iso, city, lead_score')
    .ilike('product_interest', `%${crop.crop_name_fr}%`)
    .order('lead_score', { ascending: false })
    .limit(50)

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link href={`/formation/${cropSlug}`} className="text-sm text-gray-500 hover:text-[#C9A84C]">← Tutoriel</Link>
        <div className="mt-4 mb-8">
          <div className="text-xs uppercase tracking-[.3em] text-[#C9A84C] mb-2">✓ Accès débloqué</div>
          <h1 className="text-4xl font-bold mb-2">Acheteurs potentiels · {crop.crop_name_fr}</h1>
          <p className="text-gray-400">{leads?.length ?? 0} prospects scorés intéressés par ta denrée.</p>
        </div>

        <div className="grid gap-3">
          {(leads ?? []).map((l) => (
            <div key={l.id} className="bg-[#0D1117] border border-white/10 rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="font-semibold">{l.business_name || 'Anonyme'}</div>
                <div className="text-xs text-gray-500">{l.city} · {l.country_iso}</div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                {l.email && <span>✉︎</span>}
                {l.phone && <span>📞</span>}
                {l.whatsapp && <span>💬</span>}
              </div>
              <div className="text-sm font-bold text-[#C9A84C]">{l.lead_score ?? 0}</div>
            </div>
          ))}
          {(!leads || leads.length === 0) && (
            <div className="text-center text-gray-500 italic py-10">Aucun acheteur pour cette denrée pour le moment — remonte la qualité de ton profil vendeur pour être prioritaire.</div>
          )}
        </div>
      </div>
    </div>
  )
}
