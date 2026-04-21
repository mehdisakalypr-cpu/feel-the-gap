import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServer, getAuthUser } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { TERMS_VERSION, PRODUCT_TAG } from '@/lib/terms-version'
import AcceptForm from './AcceptForm'

export const dynamic = 'force-dynamic'

const C = {
  bg: '#07090F', card: '#0D1117', border: 'rgba(201,168,76,.25)',
  gold: '#C9A84C', text: '#E5E7EB', muted: 'rgba(255,255,255,.6)',
}

async function hasAcceptedCurrent(userId: string): Promise<boolean> {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data } = await sb
    .from('signed_agreements')
    .select('id')
    .eq('user_id', userId)
    .eq('product', PRODUCT_TAG)
    .eq('agreement_version', TERMS_VERSION)
    .limit(1)
    .maybeSingle()
  return !!data
}

export default async function AcceptTermsPage({ searchParams }: { searchParams?: Promise<{ next?: string }> }) {
  const user = await getAuthUser()
  if (!user) redirect('/auth/login?next=/legal/accept')

  if (await hasAcceptedCurrent(user.id)) {
    const { next } = (await searchParams) ?? {}
    redirect(next && next.startsWith('/') ? next : '/account')
  }

  const { next } = (await searchParams) ?? {}
  const nextPath = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ fontSize: 11, color: C.gold, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 8 }}>
          Mise a jour des conditions
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 12px' }}>
          Nos conditions ont evolue
        </h1>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.65, marginBottom: 20 }}>
          Depuis votre derniere connexion, nos conditions d&apos;utilisation,
          mentions legales ou politique de confidentialite ont ete mises a
          jour. Pour continuer a utiliser Feel The Gap, merci de prendre
          connaissance de la version actuelle et de renouveler votre acceptation.
        </p>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 28 }}>
          Version en vigueur : <code style={{ color: C.gold }}>{TERMS_VERSION}</code>
        </p>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#fff' }}>Documents a relire</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9, color: C.muted }}>
            <li><Link href="/legal/cgu" target="_blank" style={{ color: C.gold }}>Conditions d&apos;utilisation (CGU)</Link></li>
            <li><Link href="/legal/mentions" target="_blank" style={{ color: C.gold }}>Mentions legales</Link></li>
            <li><Link href="/legal/privacy" target="_blank" style={{ color: C.gold }}>Politique de confidentialite</Link></li>
          </ul>
        </div>

        <AcceptForm defaultName={(user.user_metadata?.display_name as string | undefined) ?? user.email ?? ''} nextPath={nextPath} />

        <p style={{ marginTop: 28, fontSize: 11, color: C.muted, textAlign: 'center' }}>
          En validant, vous reconnaissez avoir pris connaissance de l&apos;integralite des documents ci-dessus
          et acceptez leur application a votre utilisation de Feel The Gap.
        </p>
      </div>
    </div>
  )
}
