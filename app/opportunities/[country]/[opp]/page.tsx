import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import YoutubeLiteEmbed from '@/components/YoutubeLiteEmbed'
import OppPageClient from './OppPageClient'

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

  // v2 dedup cache: videos keyed on (product_id, country_iso) only.
  // Reads from ftg_product_country_videos if populated; UI falls back to
  // content.youtube_videos (legacy per-opp cache) while v2 backfills.
  const { data: videosV2 } = opp.product_id
    ? await db
        .from('ftg_product_country_videos')
        .select('payload, status')
        .eq('product_id', opp.product_id)
        .eq('country_iso', country)
        .eq('status', 'ready')
        .maybeSingle()
    : { data: null as any }

  return { opp, country: countryRow, content, videosV2: videosV2?.payload ?? null }
}

export default async function OppPage({ params }: Params) {
  const { country, opp: oppSlug } = await params
  const data = await loadContent(country.toUpperCase(), oppSlug)
  if (!data) return notFound()

  const { opp, country: c, content, videosV2 } = data
  const countryName = c?.name_fr || c?.name_en || country
  const userLang = 'fr'  // TODO: read from i18n/cookie when multi-lang ships
  const videosData = videosV2 || content?.youtube_videos

  // Eishi layered rendering: always show the layout. Each section renders its
  // content if ready, or <SectionSynthesizing /> which polls + enqueues
  // priority=100 for paid users. No more all-or-nothing "coming soon" screen.
  const sectionStates = {
    production_methods: !!content?.production_methods,
    business_plans:     !!content?.business_plans,
    potential_clients:  !!content?.potential_clients,
    youtube_videos:     !!videosData,
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
          {content?.generated_at && (
            <span style={{ color: C.green }}>✓ Contenu à jour du {new Date(content.generated_at).toLocaleDateString('fr-FR')}</span>
          )}
        </div>

        <Section title="🏭 Méthodes de production">
          {content?.production_methods
            ? <ProductionMethodsView data={content.production_methods} />
            : <OppPageClient oppId={opp.id} country={country} section="production_methods" label="les méthodes de production" icon="🏭" />}
        </Section>

        <Section title="📋 Business plans">
          {content?.business_plans
            ? <BusinessPlansView data={content.business_plans} />
            : <OppPageClient oppId={opp.id} country={country} section="business_plans" label="votre business plan" icon="📋" />}
        </Section>

        <Section title="🤝 Clients potentiels">
          {content?.potential_clients
            ? <PotentialClientsView data={content.potential_clients} />
            : <OppPageClient oppId={opp.id} country={country} section="potential_clients" label="les clients potentiels" icon="🤝" />}
        </Section>

        <Section title="🎥 Vidéos YouTube">
          {videosData
            ? <YoutubeVideosView data={videosData} userLang={userLang} />
            : <OppPageClient oppId={opp.id} country={country} section="youtube_videos" label="les vidéos terrain" icon="🎥" />}
        </Section>
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

function YoutubeVideosView({ data, userLang }: { data: any; userLang: string }) {
  const videos = data?.videos || []
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
      {videos.map((v: any) => (
        <YoutubeLiteEmbed key={v.videoId} video={v} userLang={userLang} />
      ))}
    </div>
  )
}
