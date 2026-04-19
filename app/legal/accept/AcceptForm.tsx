'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const C = { accent: '#C9A84C', text: '#E5E7EB', muted: 'rgba(255,255,255,.6)', red: '#EF4444', bg: '#07090F', border: 'rgba(201,168,76,.25)' }

export default function AcceptForm({ defaultName, nextPath }: { defaultName: string; nextPath: string }) {
  const [typedName, setTypedName] = useState(defaultName)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const canSubmit = typedName.trim().length >= 3 && agreed && !loading

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/legal/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typed_name: typedName.trim() }),
      })
      const j = await res.json()
      if (!res.ok || !j.ok) { setError(j.error ?? 'Acceptation echouee'); return }
      router.push(nextPath)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: 12, color: C.muted }}>Nom complet (signature electronique)</span>
        <input
          type="text"
          value={typedName}
          onChange={e => setTypedName(e.target.value)}
          placeholder="Prenom Nom"
          autoComplete="name"
          required
          minLength={3}
          maxLength={120}
          style={{
            background: C.bg, color: C.text, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'Georgia, serif',
          }}
        />
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 3 }} required />
        <span>
          J&apos;ai lu et j&apos;accepte les CGU, mentions legales et politique de
          confidentialite dans leur version en vigueur, ainsi que la reconnaissance
          de la propriete intellectuelle de l&apos;editeur (art. 1366 Code civil, eIDAS).
        </span>
      </label>

      {error && <div style={{ color: C.red, fontSize: 13 }}>{error}</div>}

      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          padding: '12px 20px', borderRadius: 8, border: 'none',
          background: canSubmit ? C.accent : 'rgba(201,168,76,.3)',
          color: '#07090F', fontSize: 14, fontWeight: 700,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          alignSelf: 'start', marginTop: 4,
        }}
      >
        {loading ? 'Enregistrement…' : 'Accepter et continuer'}
      </button>
    </form>
  )
}
