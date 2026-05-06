'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const PLAN_LABEL: Record<string, string> = {
  solo_producer: 'Solo Producer',
  starter: 'Starter',
  strategy: 'Strategy',
  premium: 'Premium',
  ultimate: 'Ultimate',
}

function WaitlistForm() {
  const params = useSearchParams()
  const plan = params.get('plan') ?? ''
  const pack = params.get('pack') ?? ''
  const planLabel = PLAN_LABEL[plan] ?? (pack ? `Pack ${pack} crédits` : 'Accès anticipé')

  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.includes('@')) { setErrMsg('Email invalide'); setState('error'); return }
    setState('sending')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          plan: plan || undefined,
          pack: pack || undefined,
          locale: typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : 'fr',
          source_path: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '',
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) {
        setErrMsg(j.error || 'Erreur')
        setState('error')
        return
      }
      setState('done')
    } catch {
      setErrMsg('Réseau indisponible')
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,.25)', borderRadius: 16, padding: 32, color: '#fff' }}>
        <div style={{ color: '#C9A84C', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>✓ INSCRIT</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 12px', color: '#fff' }}>Tu es sur la liste prioritaire</h2>
        <p style={{ color: 'rgba(255,255,255,.75)', lineHeight: 1.6, margin: '0 0 16px' }}>
          On t&apos;écrit dès que la souscription est ouverte. Tu auras un accès prioritaire et une remise de bienvenue.
          <br />Vérifie ta boîte mail (et les spams) — un email de confirmation vient de partir.
        </p>
        <Link href="/reports" style={{ display: 'inline-block', background: '#C9A84C', color: '#07090F', padding: '12px 24px', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>
          Explorer les rapports →
        </Link>
      </div>
    )
  }

  return (
    <div style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,.25)', borderRadius: 16, padding: 32 }}>
      <div style={{ color: '#C9A84C', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>ACCÈS PRIORITAIRE</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 12px', color: '#fff', lineHeight: 1.15 }}>
        Plan <span style={{ color: '#C9A84C' }}>{planLabel}</span>
      </h1>
      <p style={{ color: 'rgba(255,255,255,.7)', lineHeight: 1.55, margin: '0 0 20px', fontSize: 15 }}>
        Les souscriptions ouvrent dans les prochaines semaines. Réserve ta place — on te prévient en priorité,
        et tu auras une remise de bienvenue qui ne sera pas reproposée publiquement.
      </p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ton.email@entreprise.com"
          autoComplete="email"
          disabled={state === 'sending'}
          style={{
            background: '#111827',
            border: '1px solid rgba(255,255,255,.12)',
            borderRadius: 10,
            padding: '14px 16px',
            color: '#fff',
            fontSize: 16,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          style={{
            background: state === 'sending' ? 'rgba(201,168,76,.5)' : '#C9A84C',
            color: '#07090F',
            padding: '14px 20px',
            border: 'none',
            borderRadius: 10,
            fontWeight: 800,
            fontSize: 15,
            cursor: state === 'sending' ? 'wait' : 'pointer',
          }}
        >
          {state === 'sending' ? 'Envoi…' : 'Réserver mon accès →'}
        </button>
        {state === 'error' && (
          <div style={{ color: '#F87171', fontSize: 13 }}>Erreur : {errMsg}. Réessaie ou écris-nous à contact@gapup.io.</div>
        )}
      </form>
      <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 12, marginTop: 16, lineHeight: 1.5 }}>
        En continuant tu acceptes que Feel The Gap te contacte par email à propos de cette inscription.
        Désabonnement à tout moment. Aucune carte demandée.
      </p>
    </div>
  )
}

export default function WaitlistPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#07090F', padding: '48px 24px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        <Suspense fallback={<div style={{ color: '#fff' }}>Chargement…</div>}>
          <WaitlistForm />
        </Suspense>
        <p style={{ color: 'rgba(255,255,255,.35)', textAlign: 'center', fontSize: 12, marginTop: 24 }}>
          <Link href="/" style={{ color: 'rgba(255,255,255,.5)' }}>← Retour à l&apos;accueil</Link>
        </p>
      </div>
    </main>
  )
}
