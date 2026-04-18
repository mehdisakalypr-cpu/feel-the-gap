import Link from 'next/link'

export const metadata = {
  title: 'API Platform — Feel The Gap',
  description: "Accès API institutionnel aux données d'import/export mondiales. 4 tiers : Starter, Pro, Enterprise, Sovereign.",
}

const C = {
  bg: '#07090F',
  card: '#0F172A',
  border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C',
  text: '#E2E8F0',
  muted: '#94A3B8',
  green: '#10B981',
}

type Tier = {
  code: string
  name: string
  priceYear: string
  perMin: string
  perDay: string
  features: string[]
  highlight?: boolean
  cta: string
}

const TIERS: Tier[] = [
  {
    code: 'starter',
    name: 'Starter',
    priceYear: '€12 000 / an',
    perMin: '30 req/min',
    perDay: '10 000 req/jour',
    features: [
      '938 000+ opportunités · 211 pays',
      'Mise à jour quotidienne',
      'Endpoint /v1/opportunities',
      'Support email (48h)',
      'Scopes : opportunities:read',
    ],
    cta: 'Commencer',
  },
  {
    code: 'pro',
    name: 'Pro',
    priceYear: '€40 000 / an',
    perMin: '120 req/min',
    perDay: '100 000 req/jour',
    features: [
      'Tout le Starter',
      'Endpoints /v1/countries, /v1/products',
      'Mise à jour 4× / jour',
      'Webhooks new_opportunity',
      'Support email (24h)',
    ],
    highlight: true,
    cta: 'Démarrer Pro',
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    priceYear: '€120 000 / an',
    perMin: '600 req/min',
    perDay: '1 000 000 req/jour',
    features: [
      'Tout le Pro',
      'Historique 5 ans',
      'Bulk export CSV/Parquet',
      'Scopes élargis (prices, regs, transport)',
      'SLA 99.9% · support téléphone',
      'Account manager dédié',
    ],
    cta: 'Nous contacter',
  },
  {
    code: 'sovereign',
    name: 'Sovereign',
    priceYear: '€300 000+ / an',
    perMin: '3000 req/min',
    perDay: 'Illimité',
    features: [
      'Tout le Enterprise',
      "Déploiement souverain (dans l'UE, sur vos servers)",
      "Accès raw à la base 940k+ opps",
      'API custom + batch scoring',
      'SLA 99.99% · support 24/7',
      'RGPD + ISO 27001 + NIS2',
    ],
    cta: 'Demander un devis',
  },
]

export default function ApiPlatformPage() {
  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Hero */}
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '80px 24px 40px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 11, color: C.accent, letterSpacing: '.22em', textTransform: 'uppercase', marginBottom: 12 }}>API Platform · Institutional data</div>
        <h1 style={{ fontSize: 52, fontWeight: 800, margin: 0, letterSpacing: '-.02em', lineHeight: 1.1 }}>
          L'API import/export <span style={{ color: C.accent }}>mondiale</span>.
        </h1>
        <p style={{ color: C.muted, fontSize: 18, maxWidth: 680, margin: '20px auto 0', lineHeight: 1.6 }}>
          938 000+ opportunités identifiées · 211 pays · 323 produits.<br />
          Accès direct aux données que les banques de développement, ministères et grands importateurs utilisent.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
          <Link href="#tiers" style={{
            background: C.accent, color: C.bg, padding: '14px 28px', textDecoration: 'none',
            fontWeight: 700, borderRadius: 8,
          }}>Voir les tarifs</Link>
          <a href="mailto:api@feel-the-gap.com" style={{
            background: 'transparent', color: C.text, padding: '14px 28px',
            border: `1px solid ${C.border}`, textDecoration: 'none', fontWeight: 600, borderRadius: 8,
          }}>Parler à un expert</a>
        </div>
      </div>

      {/* Tiers */}
      <div id="tiers" style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {TIERS.map(t => (
            <div key={t.code} style={{
              background: t.highlight ? 'linear-gradient(180deg, rgba(201,168,76,.08), transparent)' : C.card,
              border: `1px solid ${t.highlight ? C.accent : C.border}`,
              borderRadius: 14, padding: 28, position: 'relative',
            }}>
              {t.highlight && (
                <div style={{
                  position: 'absolute', top: -12, right: 16, background: C.accent, color: C.bg,
                  fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999, letterSpacing: '.08em',
                }}>POPULAIRE</div>
              )}
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 8 }}>{t.code}</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{t.name}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.accent, marginBottom: 16 }}>{t.priceYear}</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{t.perMin}</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>{t.perDay}</div>
              <ul style={{ padding: 0, margin: '0 0 24px', listStyle: 'none', fontSize: 13, color: C.text, lineHeight: 1.8 }}>
                {t.features.map((f, i) => (
                  <li key={i} style={{ paddingLeft: 20, position: 'relative', marginBottom: 2 }}>
                    <span style={{ position: 'absolute', left: 0, color: C.green }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/account/api-tokens" style={{
                display: 'block', textAlign: 'center',
                background: t.highlight ? C.accent : 'transparent',
                color: t.highlight ? C.bg : C.text,
                padding: '10px 20px', textDecoration: 'none', fontWeight: 700,
                border: t.highlight ? 'none' : `1px solid ${C.border}`,
                borderRadius: 8, fontSize: 13,
              }}>{t.cta}</Link>
            </div>
          ))}
        </div>
      </div>

      {/* Quick start */}
      <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 24px' }}>
        <h2 style={{ fontSize: 24, marginBottom: 16 }}>Démarrer en 30 secondes</h2>

        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 6 }}>curl</div>
            <pre style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20,
              fontSize: 13, overflow: 'auto', color: C.text, fontFamily: 'Menlo, monospace', margin: 0,
            }}>{`curl -H "Authorization: Bearer ftg_live_XXXX" \\
  "https://feel-the-gap.com/api/v1/opportunities?country=FRA&limit=50"

# → { "ok": true, "count": 1843, "items": [ ... ] }

# CSV export (jusqu'à 5000 lignes) :
curl -H "Authorization: Bearer ftg_live_XXXX" \\
  "https://feel-the-gap.com/api/v1/opportunities?format=csv" -o opps.csv`}</pre>
          </div>

          <div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 6 }}>Python (requests)</div>
            <pre style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20,
              fontSize: 13, overflow: 'auto', color: C.text, fontFamily: 'Menlo, monospace', margin: 0,
            }}>{`import requests

TOKEN = "ftg_live_XXXX"
BASE = "https://feel-the-gap.com/api/v1"

r = requests.get(
    f"{BASE}/opportunities",
    headers={"Authorization": f"Bearer {TOKEN}"},
    params={"country": "CIV", "min_score": 70, "limit": 100},
    timeout=30,
)
r.raise_for_status()
data = r.json()
print(f"{data['count']} opportunities, tier={r.headers['x-ratelimit-tier']}")`}</pre>
          </div>

          <div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 6 }}>JavaScript / TypeScript (fetch)</div>
            <pre style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20,
              fontSize: 13, overflow: 'auto', color: C.text, fontFamily: 'Menlo, monospace', margin: 0,
            }}>{`const TOKEN = process.env.FTG_API_TOKEN!
const BASE = "https://feel-the-gap.com/api/v1"

const res = await fetch(\`\${BASE}/countries?region=Africa&limit=50\`, {
  headers: { Authorization: \`Bearer \${TOKEN}\` },
})
if (!res.ok) throw new Error(\`API \${res.status}: \${await res.text()}\`)
const { items, count } = await res.json()
console.log(\`\${count} countries — remaining: \${res.headers.get('x-ratelimit-remaining-minute')}\`)`}</pre>
          </div>
        </div>

        <p style={{ color: C.muted, fontSize: 13, marginTop: 16 }}>
          Génère ton token dans <Link href="/account/api-tokens" style={{ color: C.accent }}>ton compte</Link>.
          Documentation interactive : <Link href="/docs/api" style={{ color: C.accent }}>Swagger UI /docs/api</Link>.
          Spec : <a href="/api/v1/openapi" style={{ color: C.accent }}>openapi.json</a>. CORS permissif sur <code>*</code>.
          Rate-limit par minute + par jour selon le tier. Réponse 429 avec header <code>Retry-After</code>.
        </p>
      </div>

      <div style={{ textAlign: 'center', padding: '40px 24px 80px', color: C.muted, fontSize: 13 }}>
        Besoin d'un plan sur-mesure, data souveraine, ou accès à la base raw ?<br />
        <a href="mailto:api@feel-the-gap.com" style={{ color: C.accent }}>api@feel-the-gap.com</a>
      </div>
    </div>
  )
}
