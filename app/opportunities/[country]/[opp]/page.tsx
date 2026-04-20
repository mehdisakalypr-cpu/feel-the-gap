import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

/**
 * /opportunities/[country]/[opp] — public page servie depuis le cache.
 *
 * RÈGLE ABSOLUE : aucun LLM au runtime. SELECT only from ftg_opportunity_content.
 * Si status != 'ready' → affiche placeholder "Content being generated".
 */

const C = {
  bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8',
  green: '#10B981', yellow: '#F59E0B',
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

type Params = { params: Promise<{ country: string; opp: string }> }

async function loadContent(country: string, oppSlug: string) {
  const db = admin()

  // oppSlug could be id OR slug; try id first, fallback to product_name/country
  let opp = null
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(oppSlug)) {
    const { data } = await db.from('opportunities').select('*').eq('id', oppSlug).eq('country_iso', country).maybeSingle()
    opp = data
  } else {
    const { data } = await db.from('opportunities').select('*').eq('country_iso', country).ilike('product_name', oppSlug.replace(/-/g, ' ')).limit(1).maybeSingle()
    opp = data
  }
  if (!opp) return null

  const { data: countryRow } = await db.from('countries').select('name_fr, name_en, iso3').eq('iso3', country).maybeSingle()

  const { data: content } = await db
    .from('ftg_opportunity_content')
    .select('*')
    .eq('opp_id', opp.id)
    .eq('country_iso', country)
    .eq('lang', 'fr')
    .maybeSingle()

  return { opp, country: countryRow, content }
}

export default async function OppPage({ params }: Params) {
  const { country, opp: oppSlug } = await params
  const data = await loadContent(country.toUpperCase(), oppSlug)
  if (!data) return notFound()

  const { opp, country: c, content } = data
  const countryName = c?.name_fr || c?.name_en || country

  if (!content || content.status !== 'ready') {
    return (
      <main style={{ background: C.bg, color: C.text, minHeight: '100vh', padding: '4rem 2rem' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: '1rem' }}>🌀</div>
          <h1 style={{ fontSize: 28, color: C.accent, marginBottom: '1rem' }}>
            Contenu en cours de génération
          </h1>
          <p style={{ color: C.muted, fontSize: 16, lineHeight: 1.6 }}>
            Nos agents préparent une analyse complète pour <strong>{opp.product_name}</strong> en <strong>{countryName}</strong> :
            méthodes de production, business plans détaillés, clients potentiels, et vidéos YouTube pertinentes.
          </p>
          <p style={{ color: C.muted, fontSize: 14, marginTop: '2rem' }}>
            Revenez dans quelques heures, ou demandez à l'équipe d'accélérer la génération.
          </p>
          <Link href={`/reports/${country.toLowerCase()}`}
            style={{ display: 'inline-block', marginTop: '2rem', padding: '0.75rem 1.5rem', background: C.accent, color: '#000', borderRadius: 6, textDecoration: 'none', fontWeight: 700 }}>
            ← Vue pays {countryName}
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main style={{ background: C.bg, color: C.text, minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Link href={`/reports/${country.toLowerCase()}`} style={{ color: C.muted, fontSize: 14, textDecoration: 'none' }}>← {countryName}</Link>
        <h1 style={{ fontSize: 36, margin: '1rem 0', color: C.accent }}>
          {opp.product_name} · {countryName}
        </h1>
        <div style={{ display: 'flex', gap: '2rem', color: C.muted, marginBottom: '3rem', flexWrap: 'wrap' }}>
          {opp.gap_value_usd && <span>📊 Gap d'import : <strong style={{ color: C.text }}>${(opp.gap_value_usd / 1e6).toFixed(1)}M/an</strong></span>}
          {opp.opportunity_score && <span>🎯 Score : <strong style={{ color: C.text }}>{opp.opportunity_score}/100</strong></span>}
          <span style={{ color: C.green }}>✓ Contenu à jour du {new Date(content.generated_at).toLocaleDateString('fr-FR')}</span>
        </div>

        {/* 1. Production Methods */}
        {content.production_methods && (
          <Section title="🏭 Méthodes de production">
            <ProductionMethodsView data={content.production_methods} />
          </Section>
        )}

        {/* 2. Business Plans */}
        {content.business_plans && (
          <Section title="📋 Business plans">
            <BusinessPlansView data={content.business_plans} />
          </Section>
        )}

        {/* 3. Potential Clients */}
        {content.potential_clients && (
          <Section title="🤝 Clients potentiels">
            <PotentialClientsView data={content.potential_clients} />
          </Section>
        )}

        {/* 4. YouTube Videos */}
        {content.youtube_videos && (
          <Section title="🎥 Vidéos YouTube">
            <YoutubeVideosView data={content.youtube_videos} />
          </Section>
        )}
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '3rem' }}>
      <h2 style={{ fontSize: 22, color: C.accent, marginBottom: '1rem', borderBottom: `1px solid ${C.border}`, paddingBottom: '0.5rem' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function ProductionMethodsView({ data }: { data: any }) {
  const modes = data?.modes || []
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {modes.map((m: any) => (
          <div key={m.mode} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '1rem' }}>
            <h3 style={{ color: C.accent, fontSize: 18, textTransform: 'capitalize' }}>{m.mode.replace(/_/g, ' ')}</h3>
            <p style={{ color: C.muted, fontSize: 13, marginTop: '0.5rem' }}>{m.description}</p>
            <div style={{ marginTop: '1rem', fontSize: 13 }}>
              <div>💰 CAPEX : <strong>${(m.costs?.capex_usd || 0).toLocaleString()}</strong></div>
              <div>📦 Volume : <strong>{m.yield?.annual_volume?.toLocaleString()} {m.yield?.unit}</strong></div>
              <div>👥 Employés : <strong>{m.staffing?.total_fte}</strong></div>
            </div>
          </div>
        ))}
      </div>
      {data?.recommended_mode && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(201,168,76,.1)', border: `1px solid ${C.accent}`, borderRadius: 6 }}>
          <strong style={{ color: C.accent }}>💡 Recommandé : {data.recommended_mode.replace(/_/g, ' ')}</strong>
          <p style={{ color: C.muted, fontSize: 13, marginTop: '0.5rem' }}>{data.recommendation_reasoning}</p>
        </div>
      )}
    </div>
  )
}

function BusinessPlansView({ data }: { data: any }) {
  const summaries = data?.summary_scenarios || []
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
      {summaries.map((s: any) => (
        <div key={s.level} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '1rem' }}>
          <h3 style={{ color: C.accent, fontSize: 16, textTransform: 'capitalize' }}>Scénario {s.level}</h3>
          {s.data && (
            <div style={{ marginTop: '0.75rem', fontSize: 13 }}>
              <div>CAPEX : <strong>${(s.data.capex_usd || 0).toLocaleString()}</strong></div>
              <div>OPEX/an : <strong>${(s.data.opex_year_usd || 0).toLocaleString()}</strong></div>
              <div>ROI 5Y : <strong style={{ color: C.green }}>{s.data.roi_5yr_pct || '?'}%</strong></div>
              <div>Payback : <strong>{s.data.payback_years || '?'} ans</strong></div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function PotentialClientsView({ data }: { data: any }) {
  const cats = data?.categories || []
  return (
    <div>
      {cats.slice(0, 5).map((cat: any, i: number) => (
        <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ color: C.accent, fontSize: 16 }}>{cat.category}</h3>
          <p style={{ color: C.muted, fontSize: 13, margin: '0.5rem 0' }}>{cat.typical_buyer_profile}</p>
          {cat.companies?.length > 0 && (
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', fontSize: 13 }}>
              {cat.companies.map((co: any, j: number) => (
                <li key={j} style={{ marginBottom: '0.25rem' }}>
                  <strong>{co.name}</strong> ({co.city}) — {co.why_relevant}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

function YoutubeVideosView({ data }: { data: any }) {
  const videos = data?.videos || []
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
      {videos.map((v: any) => (
        <a key={v.videoId} href={v.url} target="_blank" rel="noopener noreferrer"
          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', textDecoration: 'none', color: C.text }}>
          <img src={v.thumbnailUrl} alt={v.title} style={{ width: '100%', display: 'block' }} />
          <div style={{ padding: '0.75rem' }}>
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, minHeight: 40 }}>{v.title.slice(0, 80)}</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: '0.5rem' }}>{v.channelTitle}</div>
            <div style={{ color: C.muted, fontSize: 11, marginTop: '0.25rem' }}>
              {v.viewCount?.toLocaleString()} vues · {new Date(v.publishedAt).toLocaleDateString('fr-FR')}
            </div>
          </div>
        </a>
      ))}
    </div>
  )
}
