'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const PARCOURS = [
  { key: 'entrepreneur', label: 'Entrepreneur', icon: '🧭', color: '#C9A84C', desc: 'Explorez les marchés, créez des business plans IA, gérez vos produits et dossiers de financement.' },
  { key: 'influenceur', label: 'Influenceur', icon: '🎤', color: '#A78BFA', desc: 'Parcourez le catalogue produits, générez des liens affiliés et suivez vos gains.' },
  { key: 'financeur', label: 'Financeur', icon: '🏦', color: '#34D399', desc: 'Analysez les dossiers de financement, évaluez les risques et proposez vos conditions.' },
  { key: 'investisseur', label: 'Investisseur', icon: '📈', color: '#60A5FA', desc: 'Découvrez les opportunités d\'investissement, évaluez les valorisations et investissez.' },
]

type DemoRequest = {
  id: string
  email: string
  full_name: string
  company: string | null
  message: string | null
  status: 'pending' | 'approved' | 'rejected'
  parcours: string[] | null
  created_at: string
}

type ViewState = 'cards' | 'form' | 'pending' | 'approved' | 'rejected'

export default function DemoPage() {
  const [view, setView] = useState<ViewState>('cards')
  const [request, setRequest] = useState<DemoRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Form fields
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')

  // Step counts per parcours (loaded from API)
  const [stepCounts, setStepCounts] = useState<Record<string, number>>({})

  // Check localStorage for existing email on mount
  useEffect(() => {
    const saved = localStorage.getItem('demo_email')
    if (saved) {
      fetchStatus(saved)
    } else {
      setLoading(false)
    }

    // Load step counts for each parcours
    PARCOURS.forEach((p) => {
      fetch(`/api/demo/tour?parcours=${p.key}`)
        .then((r) => r.json())
        .then((j) => {
          if (j.steps) {
            setStepCounts((prev) => ({ ...prev, [p.key]: j.steps.length }))
          }
        })
        .catch(() => {})
    })
  }, [])

  async function fetchStatus(emailAddr: string) {
    try {
      const res = await fetch(`/api/demo/request?email=${encodeURIComponent(emailAddr)}`)
      const j = await res.json()
      if (j.request) {
        setRequest(j.request)
        if (j.request.status === 'pending') setView('pending')
        else if (j.request.status === 'approved') setView('approved')
        else if (j.request.status === 'rejected') setView('rejected')
      }
    } catch {
      // Silently fail — show default state
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/demo/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          full_name: fullName.trim(),
          company: company.trim() || null,
          message: message.trim() || null,
        }),
      })

      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Erreur')

      localStorage.setItem('demo_email', email.trim().toLowerCase())
      setRequest(j.request)

      if (j.existing && j.request.status === 'approved') {
        setView('approved')
      } else if (j.existing && j.request.status === 'pending') {
        setView('pending')
      } else {
        setView('pending')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#07090F] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[rgba(201,168,76,.15)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#C9A84C] flex items-center justify-center text-xs font-bold text-black">G</div>
          <span className="text-white font-bold">Feel The Gap</span>
          <span className="text-xs text-gray-600 ml-2">Demo</span>
        </div>
        <Link
          href="/pricing"
          className="px-4 py-1.5 rounded-full text-xs font-semibold transition-colors bg-[#C9A84C] text-black hover:bg-[#d4b65e]"
        >
          Accès complet →
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* ── STATE 1: Parcours cards ──────────────────────────────── */}
        {view === 'cards' && (
          <div className="w-full max-w-4xl">
            <div className="text-center mb-10">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
                Découvrez Feel The Gap
              </h1>
              <p className="text-gray-400 max-w-xl mx-auto">
                Explorez la plateforme à travers des parcours guidés adaptés à votre profil.
                Demandez un accès pour commencer.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
              {PARCOURS.map((p) => (
                <div
                  key={p.key}
                  className="rounded-2xl p-5 transition-all hover:scale-[1.02]"
                  style={{
                    background: '#0D1117',
                    border: `1px solid ${p.color}25`,
                  }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                      style={{ background: `${p.color}15`, border: `1px solid ${p.color}40` }}
                    >
                      {p.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-lg">{p.label}</h3>
                      {stepCounts[p.key] != null && (
                        <span
                          className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: `${p.color}20`, color: p.color }}
                        >
                          {stepCounts[p.key]} étapes
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={() => setView('form')}
                className="px-8 py-3 rounded-xl font-bold text-sm transition-all bg-[#C9A84C] text-black hover:bg-[#d4b65e] hover:scale-105"
              >
                Demander accès
              </button>
            </div>
          </div>
        )}

        {/* ── STATE 2: Registration form ──────────────────────────── */}
        {view === 'form' && (
          <div className="w-full max-w-md">
            <button
              onClick={() => setView('cards')}
              className="text-sm text-gray-500 hover:text-white mb-6 flex items-center gap-1 transition-colors"
            >
              ← Retour aux parcours
            </button>

            <div className="rounded-2xl p-6" style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,.15)' }}>
              <h2 className="text-xl font-bold text-white mb-1">Demander un accès démo</h2>
              <p className="text-sm text-gray-400 mb-6">
                Remplissez le formulaire ci-dessous. Un administrateur examinera votre demande
                et activera les parcours adaptés à votre profil.
              </p>

              {error && (
                <div className="mb-4 rounded-xl p-3 text-sm text-red-300"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@entreprise.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#07090F] border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Nom complet *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jean Dupont"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#07090F] border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Entreprise</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Mon Entreprise SAS"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#07090F] border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Message (optionnel)</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Quel parcours vous intéresse ? Contexte..."
                    className="w-full px-4 py-2.5 rounded-xl bg-[#07090F] border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C] transition-colors resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all bg-[#C9A84C] text-black hover:bg-[#d4b65e] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Envoi en cours...' : 'Envoyer ma demande'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── STATE 3: Pending ─────────────────────────────────────── */}
        {view === 'pending' && (
          <div className="w-full max-w-md text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-6"
              style={{ background: 'rgba(201,168,76,0.1)', border: '2px solid rgba(201,168,76,0.3)' }}
            >
              🕐
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Votre demande est en cours d&apos;examen
            </h2>
            <p className="text-gray-400 mb-2">
              Un administrateur va examiner votre demande et activer les parcours adaptés à votre profil.
            </p>
            <p className="text-sm text-gray-500 mb-8">
              Vous serez notifié par email une fois votre accès validé.
            </p>

            <div
              className="rounded-xl p-4 text-left"
              style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,.15)' }}
            >
              <div className="text-xs text-gray-500 mb-2">Votre demande</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Email</span>
                  <span className="text-white">{request?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Nom</span>
                  <span className="text-white">{request?.full_name}</span>
                </div>
                {request?.company && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Entreprise</span>
                    <span className="text-white">{request.company}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Statut</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400">
                    En attente
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                localStorage.removeItem('demo_email')
                setView('cards')
                setRequest(null)
              }}
              className="mt-6 text-sm text-gray-500 hover:text-white transition-colors"
            >
              Utiliser un autre email
            </button>
          </div>
        )}

        {/* ── STATE 4: Approved ────────────────────────────────────── */}
        {view === 'approved' && request && (
          <div className="w-full max-w-4xl">
            <div className="text-center mb-10">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4"
                style={{ background: 'rgba(52,211,153,0.1)', border: '2px solid rgba(52,211,153,0.3)' }}
              >
                ✅
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Votre accès est activé !
              </h2>
              <p className="text-gray-400">
                Cliquez sur un parcours pour commencer la visite guidée.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
              {PARCOURS
                .filter((p) => request.parcours?.includes(p.key))
                .map((p) => (
                  <Link
                    key={p.key}
                    href={`/demo/tour?parcours=${p.key}`}
                    className="rounded-2xl p-5 transition-all hover:scale-[1.02] group cursor-pointer block"
                    style={{
                      background: '#0D1117',
                      border: `1px solid ${p.color}25`,
                    }}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform"
                        style={{ background: `${p.color}15`, border: `1px solid ${p.color}40` }}
                      >
                        {p.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white text-lg group-hover:text-[#C9A84C] transition-colors">
                          {p.label}
                        </h3>
                        {stepCounts[p.key] != null && (
                          <span
                            className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background: `${p.color}20`, color: p.color }}
                          >
                            {stepCounts[p.key]} étapes
                          </span>
                        )}
                      </div>
                      <span className="text-gray-600 group-hover:text-[#C9A84C] transition-colors text-lg">→</span>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">{p.desc}</p>
                  </Link>
                ))}
            </div>

            {request.parcours?.length === 0 && (
              <div className="text-center text-gray-500 mt-8">
                Aucun parcours activé pour le moment. Contactez l&apos;administrateur.
              </div>
            )}

            <div className="text-center mt-8">
              <button
                onClick={() => {
                  localStorage.removeItem('demo_email')
                  setView('cards')
                  setRequest(null)
                }}
                className="text-sm text-gray-500 hover:text-white transition-colors"
              >
                Utiliser un autre email
              </button>
            </div>
          </div>
        )}

        {/* ── STATE 5: Rejected ────────────────────────────────────── */}
        {view === 'rejected' && (
          <div className="w-full max-w-md text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-6"
              style={{ background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.3)' }}
            >
              ✕
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Votre demande n&apos;a pas été retenue
            </h2>
            <p className="text-gray-400 mb-8">
              Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, n&apos;hésitez pas à nous contacter
              ou à soumettre une nouvelle demande.
            </p>

            <button
              onClick={() => {
                localStorage.removeItem('demo_email')
                setView('cards')
                setRequest(null)
              }}
              className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all bg-white/5 text-white border border-white/10 hover:border-[#C9A84C] hover:text-[#C9A84C]"
            >
              Nouvelle demande
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-gray-600 border-t border-white/5">
        Feel The Gap © {new Date().getFullYear()} — Plateforme de données import/export mondiales
      </footer>
    </div>
  )
}
