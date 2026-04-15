'use client'
import { useState } from 'react'

export default function PackCheckoutButton({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true); setErr(null)
    try {
      const res = await fetch('/api/leads/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Checkout indisponible')
      if (json.url) window.location.href = json.url
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className="mt-4 w-full py-3 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-semibold transition disabled:opacity-50"
      >
        {loading ? 'Redirection…' : 'Acheter le pack →'}
      </button>
      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
    </>
  )
}
