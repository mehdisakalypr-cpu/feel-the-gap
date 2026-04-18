'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const C = {
  bg: '#07090F',
  card: '#0F172A',
  border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C',
  text: '#E2E8F0',
  muted: '#94A3B8',
  green: '#10B981',
  orange: '#F59E0B',
  red: '#EF4444',
}

const PLAN_LABEL: Record<string, string> = {
  free: 'Explorer (gratuit)',
  solo_producer: 'Solo Producer',
  data: 'Data',
  starter: 'Data',
  strategy: 'Strategy',
  premium: 'Premium',
  ultimate: 'Ultimate',
  custom: 'Enterprise',
}

const ACTION_LABEL: Record<string, string> = {
  fillthegap_video: 'Vidéos du marché',
  fillthegap_clients: 'Clients potentiels',
  fillthegap_store: 'Site e-commerce',
  fillthegap_recap: 'Synthèse / Recap',
  fillthegap_ai: 'AI engine',
  fillthegap_bp_bulk: 'Business plans (bulk)',
}

type Balance = {
  ok: boolean
  balance: number
  grant: number
  plan: string
  periodEnd: string | null
}

type TxRow = {
  id: string
  action: string
  qty: number
  ref_type: string | null
  ref_id: string | null
  created_at: string
}

export default function UsagePage() {
  const [bal, setBal] = useState<Balance | null>(null)
  const [history, setHistory] = useState<TxRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [b, h] = await Promise.all([
          fetch('/api/credits/fillthegap/balance', { cache: 'no-store' }).then(r => r.json()),
          fetch('/api/credits/fillthegap/history', { cache: 'no-store' }).then(r => r.json()),
        ])
        if (!b.ok) throw new Error(b.error || 'balance error')
        setBal(b)
        if (h.ok) setHistory(h.items ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'erreur')
      }
      setLoading(false)
    }
    void load()
  }, [])

  const used = bal ? Math.max(0, bal.grant - bal.balance) : 0
  const pct = bal && bal.grant > 0 ? Math.min(100, (used / bal.grant) * 100) : 0
  const barColor = pct >= 90 ? C.red : pct >= 70 ? C.orange : C.green

  const byAction: Record<string, { count: number; qty: number }> = {}
  for (const t of history) {
    const a = t.action
    byAction[a] = byAction[a] ?? { count: 0, qty: 0 }
    byAction[a].count++
    byAction[a].qty += t.qty
  }

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: C.accent, letterSpacing: '.2em', textTransform: 'uppercase' }}>Mon compte</div>
            <h1 style={{ fontSize: 32, fontWeight: 800, margin: '6px 0 0' }}>Usage Fill the Gap</h1>
          </div>
          <Link href="/account" style={{ color: C.accent, fontSize: 13, textDecoration: 'none' }}>← Retour au compte</Link>
        </div>

        {loading && <div style={{ color: C.muted, padding: 40, textAlign: 'center' }}>Chargement…</div>}

        {error && (
          <div style={{ background: 'rgba(239,68,68,.1)', border: `1px solid ${C.red}`, color: C.red, padding: 16, borderRadius: 10 }}>
            {error === 'unauthorized' ? 'Connecte-toi pour voir ton usage.' : error}
          </div>
        )}

        {bal && !loading && (
          <>
            {/* Compteur principal */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Plan actuel
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{PLAN_LABEL[bal.plan] ?? bal.plan}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 36, fontWeight: 800, color: C.accent, lineHeight: 1 }}>
                    {bal.balance}
                    <span style={{ fontSize: 16, color: C.muted, fontWeight: 500 }}>/{bal.grant}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                    crédits restants ce mois
                  </div>
                </div>
              </div>

              {bal.grant > 0 && (
                <>
                  <div style={{ marginTop: 20, background: 'rgba(255,255,255,.05)', height: 8, borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: barColor, transition: 'width .4s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted, marginTop: 8 }}>
                    <span>{used} utilisés ({pct.toFixed(0)}%)</span>
                    {bal.periodEnd && (
                      <span>Reset le {new Date(bal.periodEnd).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                    )}
                  </div>
                </>
              )}

              {bal.grant === 0 && (
                <div style={{ marginTop: 16, padding: 14, background: 'rgba(201,168,76,.08)', border: `1px solid ${C.border}`, borderRadius: 10 }}>
                  <div style={{ fontSize: 13, marginBottom: 10 }}>
                    Ton plan actuel n'inclut pas de crédits Fill the Gap mensuels.
                    Passe en <strong style={{ color: C.accent }}>Premium (149€, 150 crédits/mo)</strong> ou <strong style={{ color: C.accent }}>Ultimate (299€, 250 crédits/mo)</strong>.
                  </div>
                  <Link href="/pricing" style={{
                    display: 'inline-block', background: C.accent, color: C.bg,
                    padding: '8px 16px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 13,
                  }}>Voir les plans →</Link>
                </div>
              )}
            </div>

            {/* Breakdown par action */}
            {history.length > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: C.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 14 }}>
                  Répartition par type d'action
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {Object.entries(byAction)
                    .sort((a, b) => b[1].qty - a[1].qty)
                    .map(([action, v]) => (
                      <div key={action} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                        <span style={{ color: C.text }}>{ACTION_LABEL[action] ?? action}</span>
                        <span style={{ color: C.muted, fontSize: 11 }}>{v.count}×</span>
                        <strong style={{ color: C.accent }}>{v.qty} cr.</strong>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Historique détaillé */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 13, color: C.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 14 }}>
                Historique récent ({history.length}/50)
              </div>
              {history.length === 0 ? (
                <div style={{ color: C.muted, padding: 16, textAlign: 'center', fontSize: 13 }}>
                  Aucune action encore. Démarre un parcours depuis la carte.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                  {history.map(t => (
                    <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: 10, padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ color: C.muted, fontFamily: 'Menlo, monospace' }}>
                        {new Date(t.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                        {' '}
                        {new Date(t.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ color: C.text }}>
                        {ACTION_LABEL[t.action] ?? t.action}
                        {t.ref_type && <span style={{ color: C.muted, marginLeft: 8, fontSize: 11 }}>({t.ref_type})</span>}
                      </span>
                      <strong style={{ color: C.accent }}>−{t.qty}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
