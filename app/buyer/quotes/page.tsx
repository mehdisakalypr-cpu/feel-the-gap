import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServer, getAuthUser } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const C = {
  bg: '#0A0E1A', card: '#0F172A', border: 'rgba(96,165,250,.2)',
  accent: '#60A5FA', text: '#E2E8F0', muted: '#64748B', green: '#10B981', amber: '#F59E0B',
}

type QuoteRow = {
  id: string
  product_id: string
  buyer_email: string
  buyer_company: string
  buyer_country: string | null
  quantity: string | null
  incoterm: string | null
  destination: string | null
  message: string | null
  status: string
  created_at: string
  seller_id: string
}

type ProductRow = {
  id: string
  slug: string | null
  title: string
  origin_country: string
  unit_price_eur: number
  unit: string | null
  seller_id: string
}

type SellerRow = { id: string; seller_slug: string | null; username: string | null }

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  new:      { label: 'Envoyée',     color: C.amber },
  viewed:   { label: 'Vue',         color: C.accent },
  quoted:   { label: 'Devis reçu',  color: C.green },
  accepted: { label: 'Acceptée',    color: C.green },
  declined: { label: 'Refusée',     color: C.muted },
  expired:  { label: 'Expirée',     color: C.muted },
}

export default async function BuyerQuotesPage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth/login?next=/buyer/quotes')

  const sb = await createSupabaseServer()
  const { data: quotes } = await sb
    .from('seller_quote_requests')
    .select('id, product_id, buyer_email, buyer_company, buyer_country, quantity, incoterm, destination, message, status, created_at, seller_id')
    .or(`buyer_id.eq.${user.id},buyer_email.eq.${user.email ?? ''}`)
    .order('created_at', { ascending: false })
    .limit(200)

  const rows = (quotes ?? []) as QuoteRow[]
  const productIds = [...new Set(rows.map(r => r.product_id))]
  const sellerIds = [...new Set(rows.map(r => r.seller_id))]

  const productsPromise = productIds.length
    ? sb.from('seller_products')
        .select('id, slug, title, origin_country, unit_price_eur, unit, seller_id')
        .in('id', productIds)
    : Promise.resolve({ data: [] as ProductRow[] })
  const sellersPromise = sellerIds.length
    ? sb.from('profiles')
        .select('id, seller_slug, username')
        .in('id', sellerIds)
    : Promise.resolve({ data: [] as SellerRow[] })
  const [{ data: products }, { data: sellers }] = await Promise.all([productsPromise, sellersPromise])
  const productMap = new Map((products as ProductRow[] | null ?? []).map(p => [p.id, p]))
  const sellerMap = new Map((sellers as SellerRow[] | null ?? []).map(s => [s.id, s]))

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 6 }}>Espace acheteur</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 24px' }}>Mes demandes de devis</h1>

        <div style={{ display: 'flex', gap: 12, marginBottom: 24, fontSize: 13 }}>
          <Link href="/buyer/quotes" style={{ color: C.accent, textDecoration: 'none', borderBottom: `2px solid ${C.accent}`, paddingBottom: 6 }}>Devis ({rows.length})</Link>
          <Link href="/buyer/contracts" style={{ color: C.muted, textDecoration: 'none', paddingBottom: 6 }}>Contrats</Link>
        </div>

        {rows.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 40, textAlign: 'center', color: C.muted, borderRadius: 12 }}>
            <div style={{ fontSize: 15, marginBottom: 8, color: C.text }}>Aucune demande de devis pour le moment</div>
            <div style={{ fontSize: 13 }}>Parcourez le <Link href="/marketplace" style={{ color: C.accent }}>marketplace</Link> pour trouver des produits à l'export.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {rows.map(q => {
              const p = productMap.get(q.product_id)
              const s = sellerMap.get(q.seller_id)
              const st = STATUS_LABEL[q.status] ?? { label: q.status, color: C.muted }
              return (
                <div key={q.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                        {p?.title ?? '(produit retiré)'}
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
                        Vendeur : {s?.username ?? s?.seller_slug ?? '—'} · Origine {p?.origin_country ?? '—'}
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 13, color: C.text, flexWrap: 'wrap' }}>
                        <span>Qté : <strong>{q.quantity ?? '—'}</strong> {p?.unit ?? ''}</span>
                        <span>Incoterm : <strong>{q.incoterm ?? '—'}</strong></span>
                        <span>Destination : <strong>{q.destination ?? q.buyer_country ?? '—'}</strong></span>
                      </div>
                      {q.message && (
                        <div style={{ marginTop: 12, padding: 10, background: 'rgba(96,165,250,.05)', borderLeft: `2px solid ${C.accent}`, fontSize: 13, color: C.muted }}>
                          « {q.message.slice(0, 240)}{q.message.length > 240 ? '…' : ''} »
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        display: 'inline-block', padding: '4px 10px', borderRadius: 20,
                        background: `${st.color}20`, color: st.color, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                      }}>{st.label}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                        {new Date(q.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      {p && (
                        <Link href={s?.seller_slug ? `/seller/${s.seller_slug}` : `/seller/${q.seller_id}`}
                          style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: C.accent, textDecoration: 'none' }}>
                          Voir la boutique →
                        </Link>
                      )}
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
