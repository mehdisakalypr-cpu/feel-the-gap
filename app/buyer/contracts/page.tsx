import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServer, getAuthUser } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const C = {
  bg: '#0A0E1A', card: '#0F172A', border: 'rgba(96,165,250,.2)',
  accent: '#60A5FA', text: '#E2E8F0', muted: '#64748B', green: '#10B981', amber: '#F59E0B', red: '#EF4444',
}

type ContractRow = {
  id: string
  product_id: string | null
  seller_id: string | null
  buyer_id: string | null
  incoterm: string
  status: string
  signed_at: string | null
  signed_by_seller: string | null
  signed_by_buyer: string | null
  created_at: string
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:          { label: 'Brouillon',           color: C.muted },
  pending_seller: { label: 'En attente vendeur',  color: C.amber },
  pending_buyer:  { label: 'À signer',            color: C.amber },
  signed:         { label: 'Signé',               color: C.green },
  cancelled:      { label: 'Annulé',              color: C.red },
}

export default async function BuyerContractsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth/login?next=/buyer/contracts')

  const sb = await createSupabaseServer()
  const { data: contracts } = await sb
    .from('incoterms_contracts')
    .select('id, product_id, seller_id, buyer_id, incoterm, status, signed_at, signed_by_seller, signed_by_buyer, created_at')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const rows = (contracts ?? []) as ContractRow[]

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 6 }}>Espace acheteur</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 24px' }}>Mes contrats</h1>

        <div style={{ display: 'flex', gap: 12, marginBottom: 24, fontSize: 13 }}>
          <Link href="/buyer/quotes" style={{ color: C.muted, textDecoration: 'none', paddingBottom: 6 }}>Devis</Link>
          <Link href="/buyer/contracts" style={{ color: C.accent, textDecoration: 'none', borderBottom: `2px solid ${C.accent}`, paddingBottom: 6 }}>Contrats ({rows.length})</Link>
        </div>

        {rows.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 40, textAlign: 'center', color: C.muted, borderRadius: 12 }}>
            <div style={{ fontSize: 15, marginBottom: 8, color: C.text }}>Aucun contrat en attente</div>
            <div style={{ fontSize: 13 }}>Les contrats Incoterms apparaissent ici après acceptation d'un devis.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {rows.map(c => {
              const st = STATUS_LABEL[c.status] ?? { label: c.status, color: C.muted }
              const needsSignature = c.status === 'pending_buyer' || (c.status === 'draft' && !c.signed_by_buyer)
              return (
                <div key={c.id} style={{ background: C.card, border: `1px solid ${needsSignature ? C.amber : C.border}`, borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                        Contrat <span style={{ color: C.accent }}>{c.incoterm}</span> 2020
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
                        Créé le {new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: C.muted, flexWrap: 'wrap' }}>
                        <span>Vendeur : {c.signed_by_seller ? <strong style={{ color: C.green }}>{c.signed_by_seller} ✓</strong> : <em>non signé</em>}</span>
                        <span>Acheteur : {c.signed_by_buyer ? <strong style={{ color: C.green }}>{c.signed_by_buyer} ✓</strong> : <em>non signé</em>}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        display: 'inline-block', padding: '4px 10px', borderRadius: 20,
                        background: `${st.color}20`, color: st.color, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                      }}>{st.label}</div>
                      <div style={{ marginTop: 10 }}>
                        <Link href={`/buyer/contracts/${c.id}`} style={{
                          display: 'inline-block', padding: '6px 14px',
                          background: needsSignature ? C.accent : 'transparent',
                          color: needsSignature ? C.bg : C.accent,
                          border: `1px solid ${C.accent}`,
                          borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none',
                        }}>
                          {needsSignature ? 'Consulter & signer' : 'Consulter'}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
