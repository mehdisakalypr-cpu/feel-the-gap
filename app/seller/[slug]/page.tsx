import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import QuoteButton from './QuoteButton'

export const revalidate = 300 // ISR 5 min

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const C = { bg: '#0A0E1A', card: '#0F172A', border: 'rgba(96,165,250,.2)', accent: '#60A5FA', text: '#E2E8F0', muted: '#64748B', green: '#10B981' }

type Product = {
  id: string; slug: string; title: string; description: string | null; hs_code: string | null
  origin_country: string; origin_port: string | null; unit_price_eur: number; unit: string
  available_qty: number | null; min_order_qty: number | null; incoterm_preferred: string | null
  images: string[]; certifications: string[]; views_count: number; quotes_requested_count: number
}

type SellerProfile = { id: string; seller_slug: string; username: string | null; email: string | null }

async function getSellerData(slug: string): Promise<{ seller: SellerProfile; products: Product[] } | null> {
  const { data: seller } = await sb.from('profiles')
    .select('id, seller_slug, username, email')
    .eq('seller_slug', slug)
    .maybeSingle()
  if (!seller) return null
  const { data: products } = await sb.from('seller_products')
    .select('id, slug, title, description, hs_code, origin_country, origin_port, unit_price_eur, unit, available_qty, min_order_qty, incoterm_preferred, images, certifications, views_count, quotes_requested_count')
    .eq('seller_id', seller.id)
    .eq('status', 'active')
    .eq('visibility', 'public')
    .order('updated_at', { ascending: false })
  return { seller: seller as SellerProfile, products: (products as Product[]) ?? [] }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getSellerData(slug)
  if (!data) return { title: 'Vendeur introuvable — Feel The Gap' }
  const sellerName = data.seller.username || data.seller.seller_slug
  return {
    title: `${sellerName} — Catalogue export B2B | Feel The Gap`,
    description: `${data.products.length} produits disponibles à l'export. Origine ${[...new Set(data.products.map(p => p.origin_country))].join(', ')}.`,
  }
}

export default async function PublicSellerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getSellerData(slug)
  if (!data) notFound()
  const { seller, products } = data
  const sellerName = seller.username || seller.seller_slug
  const origins = [...new Set(products.map(p => p.origin_country))]

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: '32px 24px', background: 'linear-gradient(180deg, rgba(96,165,250,.06), transparent)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 6 }}>Catalogue export B2B</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0, color: C.text }}>{sellerName}</h1>
          <div style={{ display: 'flex', gap: 24, marginTop: 12, color: C.muted, fontSize: 13, flexWrap: 'wrap' }}>
            <span><strong style={{ color: C.text }}>{products.length}</strong> produit{products.length > 1 ? 's' : ''}</span>
            {origins.length > 0 && <span>Origine{origins.length > 1 ? 's' : ''} : <strong style={{ color: C.text }}>{origins.join(', ')}</strong></span>}
            <span style={{ color: C.green }}>● Vendeur actif</span>
          </div>
        </div>
      </div>

      {/* Products grid */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        {products.length === 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 40, textAlign: 'center', color: C.muted }}>
            Aucun produit publié pour le moment.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {products.map(p => (
            <article key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
              {p.images?.[0] && (
                <div style={{ width: '100%', height: 200, overflow: 'hidden', background: C.bg }}>
                  <img src={p.images[0]} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(96,165,250,.15)', color: C.accent, fontWeight: 700 }}>{p.origin_country}</span>
                  {p.hs_code && <span style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(100,116,139,.15)', color: C.muted, fontFamily: 'monospace' }}>HS {p.hs_code}</span>}
                  {p.incoterm_preferred && <span style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(16,185,129,.15)', color: C.green, fontWeight: 700 }}>{p.incoterm_preferred}</span>}
                </div>
                <h3 style={{ margin: '4px 0 8px', fontSize: 17, fontWeight: 700 }}>{p.title}</h3>
                {p.description && <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.5, margin: '0 0 12px' }}>{p.description}</p>}
                {p.certifications?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                    {p.certifications.map(c => <span key={c} style={{ fontSize: 10, padding: '2px 6px', border: `1px solid ${C.border}`, color: C.muted }}>{c}</span>)}
                  </div>
                )}
                <div style={{ marginTop: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{p.unit_price_eur}€</span>
                    <span style={{ color: C.muted, fontSize: 13 }}>/ {p.unit}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
                    {p.min_order_qty != null && <>MOQ {p.min_order_qty}{p.unit} · </>}
                    {p.available_qty != null && <>Stock {p.available_qty}{p.unit} · </>}
                    {p.origin_port && <>Port {p.origin_port}</>}
                  </div>
                  <QuoteButton
                    productId={p.id}
                    sellerId={seller.id}
                    productTitle={p.title}
                    originCountry={p.origin_country}
                    originPort={p.origin_port}
                    unitPriceEur={p.unit_price_eur}
                    unit={p.unit}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: '24px', textAlign: 'center', color: C.muted, fontSize: 11, marginTop: 40 }}>
        Catalogue propulsé par <a href="/" style={{ color: C.accent, textDecoration: 'none' }}>Feel The Gap</a> — données import/export mondiales pour acheteurs B2B vérifiés.
      </div>
    </div>
  )
}
