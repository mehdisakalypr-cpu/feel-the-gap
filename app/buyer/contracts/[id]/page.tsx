import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServer, getAuthUser } from '@/lib/supabase-server'
import SignForm from './SignForm'
import ContractView from './ContractView'

export const dynamic = 'force-dynamic'

const C = {
  bg: '#0A0E1A', card: '#0F172A', border: 'rgba(96,165,250,.2)',
  accent: '#60A5FA', text: '#E2E8F0', muted: '#64748B', green: '#10B981', amber: '#F59E0B',
}

type Contract = {
  id: string
  product_id: string | null
  seller_id: string | null
  buyer_id: string | null
  incoterm: string
  contract_html: string
  status: string
  signed_at: string | null
  signed_by_seller: string | null
  signed_by_buyer: string | null
  created_at: string
}

export default async function BuyerContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) redirect(`/auth/login?next=/buyer/contracts/${id}`)

  const sb = await createSupabaseServer()
  const { data: contract } = await sb
    .from('incoterms_contracts')
    .select('id, product_id, seller_id, buyer_id, incoterm, contract_html, status, signed_at, signed_by_seller, signed_by_buyer, created_at')
    .eq('id', id)
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (!contract) notFound()
  const c = contract as Contract

  const canSign = !c.signed_by_buyer && c.status !== 'cancelled'
  const fullySigned = !!c.signed_by_buyer && !!c.signed_by_seller

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        <Link href="/buyer/contracts" style={{ color: C.muted, fontSize: 12, textDecoration: 'none' }}>← Mes contrats</Link>

        <div style={{ marginTop: 16, fontSize: 11, color: C.muted, letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 6 }}>
          Contrat Incoterms 2020
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 24px' }}>
          {c.incoterm} — {c.signed_by_seller ? <span style={{ color: C.green }}>Signé vendeur ✓</span> : <span style={{ color: C.amber }}>En attente vendeur</span>}
          {' · '}
          {c.signed_by_buyer ? <span style={{ color: C.green }}>Signé acheteur ✓</span> : <span style={{ color: C.amber }}>À signer</span>}
        </h1>

        {fullySigned && (
          <div style={{ background: `${C.green}15`, border: `1px solid ${C.green}40`, borderRadius: 12, padding: 16, marginBottom: 24, color: C.green, fontSize: 14 }}>
            ✓ Ce contrat est pleinement signé et opposable. Signé le {c.signed_at ? new Date(c.signed_at).toLocaleDateString('fr-FR', { dateStyle: 'long' }) : '—'}.
          </div>
        )}

        <ContractView html={c.contract_html} />

        {canSign ? (
          <div style={{ background: C.card, border: `1px solid ${C.amber}40`, borderRadius: 12, padding: 24, marginTop: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Signature électronique</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              En tapant votre nom complet, vous confirmez avoir lu et accepté l'intégralité du contrat ci-dessus. La signature sera horodatée et hashée (SHA-256) pour opposabilité (eIDAS, art. 1366 Code civil).
            </div>
            <SignForm contractId={c.id} />
          </div>
        ) : !c.signed_by_buyer ? null : (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, fontSize: 13, color: C.muted, marginTop: 24 }}>
            Vous avez signé ce contrat en tant que <strong style={{ color: C.text }}>{c.signed_by_buyer}</strong>.
          </div>
        )}
      </div>
    </div>
  )
}
