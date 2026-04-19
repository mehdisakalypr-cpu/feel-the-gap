'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const C = { accent: '#60A5FA', text: '#E2E8F0', muted: '#64748B', green: '#10B981', red: '#EF4444', bg: '#0A0E1A', border: 'rgba(96,165,250,.25)' }

export default function SignForm({ contractId }: { contractId: string }) {
  const [typedName, setTypedName] = useState('')
  const [agreeRead, setAgreeRead] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const canSubmit = typedName.trim().length >= 3 && agreeRead && !loading

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/buyer/contracts/${contractId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typed_name: typedName.trim(), scroll_completed: true }),
      })
      const j = await res.json()
      if (!res.ok || !j.ok) { setError(j.error ?? 'Signature échouée'); return }
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: 12, color: C.muted }}>Nom complet (signature)</span>
        <input
          type="text"
          value={typedName}
          onChange={e => setTypedName(e.target.value)}
          placeholder="Prénom Nom"
          autoComplete="name"
          style={{
            background: C.bg, color: C.text, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'Georgia, serif',
          }}
          required minLength={3} maxLength={120}
        />
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: C.muted }}>
        <input type="checkbox" checked={agreeRead} onChange={e => setAgreeRead(e.target.checked)} style={{ marginTop: 3 }} />
        <span>J'ai lu l'intégralité du contrat ci-dessus et j'accepte sans réserve les obligations qui s'y rattachent (art. 1366 Code civil, eIDAS).</span>
      </label>

      {error && <div style={{ color: C.red, fontSize: 13 }}>{error}</div>}

      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          padding: '10px 18px', borderRadius: 8, border: 'none',
          background: canSubmit ? C.accent : C.muted,
          color: C.bg, fontSize: 14, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed',
          alignSelf: 'start',
        }}
      >
        {loading ? 'Signature en cours…' : 'Signer électroniquement'}
      </button>
    </form>
  )
}
