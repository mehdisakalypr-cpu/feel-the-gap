/**
 * Trade Pulse newsletter landing — Phase 0 launch lever.
 *
 * Goal: collect email subscribers for weekly trade intelligence digest.
 * Cible : 5k abonnés d'ici 20 mai 2026 launch (Phase 0 channel diversity).
 *
 * Form posts to /api/newsletter/subscribe (creates row in newsletter_subscribers).
 * Public route — added to PUBLIC_PAGES allowlist in proxy.ts.
 */
'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function NewsletterPage() {
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('FR')
  const [interest, setInterest] = useState('all')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setError('')

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, country, interest }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `HTTP ${res.status}`)
      }
      setStatus('success')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    }
  }

  if (status === 'success') {
    return (
      <main style={{ background: '#07090F', color: '#FFF', minHeight: '100vh' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '120px 24px', textAlign: 'center' }}>
          <span style={{ fontSize: 64 }}>✅</span>
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: '24px 0 16px' }}>Inscription confirmée</h1>
          <p style={{ fontSize: 18, color: '#9CA3AF', marginBottom: 32 }}>
            Tu reçois Trade Pulse chaque mardi 7h CET. Premier numéro dans tes mails dans &lt; 7 jours.
          </p>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: 'linear-gradient(90deg, #FF6B6B, #FFD93D)',
              color: '#FFF',
              borderRadius: 999,
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            ← Retour FTG
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main style={{ background: '#07090F', color: '#FFF', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px' }}>
        <header style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ display: 'inline-block', padding: '6px 14px', background: '#FF6B6B22', border: '1px solid #FF6B6B', borderRadius: 999, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 20, color: '#FF6B6B' }}>
            🌍 Newsletter trade intelligence
          </span>
          <h1 style={{ fontSize: 48, fontWeight: 800, margin: '0 0 16px', lineHeight: 1.1 }}>
            Trade Pulse — l'opportunité de la semaine, livrée chaque mardi
          </h1>
          <p style={{ fontSize: 18, color: '#9CA3AF', maxWidth: 720, margin: '0 auto' }}>
            5 minutes pour identifier où vendre tes produits avant tes concurrents. Données import/export mondiales décodées par notre IA. Gratuit, 1 email/semaine.
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 480px)', gap: 48, alignItems: 'start' }}>
          {/* Left: value props */}
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 24px' }}>Ce que tu reçois chaque mardi</h2>

            <div style={{ marginBottom: 24, padding: 20, background: '#1A1130', border: '1px solid #2D1F4D', borderRadius: 12 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>1 opportunité de marché</h3>
              <p style={{ fontSize: 14, color: '#D1D5DB', margin: 0 }}>
                Un produit × un pays import × un gap concurrentiel à exploiter. Données chiffrées + acheteurs identifiés.
              </p>
            </div>

            <div style={{ marginBottom: 24, padding: 20, background: '#1A1130', border: '1px solid #2D1F4D', borderRadius: 12 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔥</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>3 trade shows à ne pas manquer</h3>
              <p style={{ fontSize: 14, color: '#D1D5DB', margin: 0 }}>
                Salons B2B où ton ICP est concentré, dans les 60 prochains jours. Acheteurs + horaires + stratégie d'approche.
              </p>
            </div>

            <div style={{ marginBottom: 24, padding: 20, background: '#1A1130', border: '1px solid #2D1F4D', borderRadius: 12 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>1 disruption à anticiper</h3>
              <p style={{ fontSize: 14, color: '#D1D5DB', margin: 0 }}>
                Tarifs CBAM, sanctions, nouvelles routes shipping, devises volatiles. Ce qui va impacter ton import/export ce mois.
              </p>
            </div>

            <div style={{ marginBottom: 24, padding: 20, background: '#1A1130', border: '1px solid #2D1F4D', borderRadius: 12 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📈</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>1 case study chiffré</h3>
              <p style={{ fontSize: 14, color: '#D1D5DB', margin: 0 }}>
                Une entreprise qui a vu un gap, l'a exploité, et fait du chiffre. ROI réel, méthode applicable.
              </p>
            </div>

            <div style={{ padding: 16, background: '#1F1535', border: '1px solid #FFD93D44', borderRadius: 12, fontSize: 13, color: '#D1D5DB' }}>
              <strong style={{ color: '#FFD93D' }}>🚀 Bonus 20 mai launch :</strong> les 1000 premiers abonnés reçoivent un rapport pays personnalisé gratuit (15 pages) la semaine de l'ouverture FTG.
            </div>
          </div>

          {/* Right: form */}
          <div style={{ position: 'sticky', top: 24 }}>
            <form onSubmit={handleSubmit} style={{ padding: 32, background: 'linear-gradient(135deg, #1F1535, #2D1F4D)', borderRadius: 16, border: '1px solid #FFD93D44' }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px', color: '#FFD93D' }}>Inscription gratuite</h2>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 24px' }}>1 email/semaine · 0 spam · désinscription en 1 clic</p>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Email professionnel</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@entreprise.com"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#07090F',
                  border: '1px solid #2D1F4D',
                  borderRadius: 8,
                  color: '#FFF',
                  fontSize: 14,
                  marginBottom: 16,
                  boxSizing: 'border-box',
                }}
              />

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Pays</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#07090F',
                  border: '1px solid #2D1F4D',
                  borderRadius: 8,
                  color: '#FFF',
                  fontSize: 14,
                  marginBottom: 16,
                }}
              >
                <option value="FR">🇫🇷 France</option>
                <option value="DE">🇩🇪 Allemagne</option>
                <option value="ES">🇪🇸 Espagne</option>
                <option value="IT">🇮🇹 Italie</option>
                <option value="GB">🇬🇧 Royaume-Uni</option>
                <option value="MA">🇲🇦 Maroc</option>
                <option value="TN">🇹🇳 Tunisie</option>
                <option value="DZ">🇩🇿 Algérie</option>
                <option value="SN">🇸🇳 Sénégal</option>
                <option value="CI">🇨🇮 Côte d'Ivoire</option>
                <option value="US">🇺🇸 États-Unis</option>
                <option value="CA">🇨🇦 Canada</option>
                <option value="OTHER">🌍 Autre</option>
              </select>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Centre d'intérêt principal</label>
              <select
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#07090F',
                  border: '1px solid #2D1F4D',
                  borderRadius: 8,
                  color: '#FFF',
                  fontSize: 14,
                  marginBottom: 24,
                }}
              >
                <option value="all">Tous secteurs</option>
                <option value="agri">Agriculture / Food</option>
                <option value="industry">Industrie / Manufacturing</option>
                <option value="health">Santé / Pharma</option>
                <option value="luxury">Luxe / Cosmétique</option>
                <option value="tech">Tech / Électronique</option>
                <option value="energy">Énergie / Renouvelables</option>
                <option value="textile">Textile / Mode</option>
              </select>

              <button
                type="submit"
                disabled={status === 'loading'}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  background: status === 'loading' ? '#666' : 'linear-gradient(90deg, #FF6B6B, #FFD93D)',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: 999,
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                }}
              >
                {status === 'loading' ? 'Envoi...' : 'Recevoir Trade Pulse →'}
              </button>

              {error && (
                <div style={{ marginTop: 16, padding: 12, background: '#7F1D1D', borderRadius: 8, fontSize: 13 }}>
                  ❌ {error}
                </div>
              )}

              <p style={{ marginTop: 16, fontSize: 11, color: '#6B7280', textAlign: 'center' }}>
                Tes données sont protégées (RGPD). Voir <Link href="/legal/mentions" style={{ color: '#9CA3AF' }}>mentions légales</Link>.
              </p>
            </form>
          </div>
        </div>

        <footer style={{ textAlign: 'center', marginTop: 64, padding: 24, color: '#6B7280', fontSize: 13 }}>
          Trade Pulse est éditée par Feel The Gap. <Link href="/" style={{ color: '#9CA3AF' }}>Retour FTG</Link>
        </footer>
      </div>
    </main>
  )
}
