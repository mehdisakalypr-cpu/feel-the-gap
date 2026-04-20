'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface MediaItem {
  id: string
  type: 'photo' | 'video'
  url: string
  caption: string | null
  position: number
  is_cover: boolean
}

interface Props {
  productId: string
  initial: MediaItem[]
}

const MAX_PHOTOS = 10

export function MediaManager({ productId, initial }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<MediaItem[]>(initial)
  const [busy, setBusy] = useState(false)
  const [type, setType] = useState<'photo' | 'video'>('photo')
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const photoCount = items.filter(i => i.type === 'photo').length

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!url.trim()) { setErr('URL requise.'); return }
    if (type === 'photo' && photoCount >= MAX_PHOTOS) {
      setErr(`Maximum ${MAX_PHOTOS} photos atteint.`); return
    }
    try { new URL(url) } catch { setErr('URL invalide.'); return }

    setBusy(true)
    try {
      const r = await fetch(`/api/store/products/${productId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, url: url.trim(), caption: caption.trim() || null }),
      })
      const j = await r.json()
      if (!r.ok || j.error) {
        setErr(j.message ?? j.error ?? 'Ajout impossible.')
      } else if (j.item) {
        setItems(prev => [...prev, j.item])
        setUrl('')
        setCaption('')
        router.refresh()
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'R\u00e9seau indisponible.')
    } finally { setBusy(false) }
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce m\u00e9dia ?')) return
    setBusy(true)
    try {
      const r = await fetch(`/api/store/products/${productId}/media?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (r.ok) {
        setItems(prev => prev.filter(i => i.id !== id))
        router.refresh()
      }
    } finally { setBusy(false) }
  }

  async function setCover(id: string) {
    setBusy(true)
    try {
      const r = await fetch(`/api/store/products/${productId}/media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_cover: true }),
      })
      if (r.ok) {
        setItems(prev => prev.map(i => ({ ...i, is_cover: i.id === id })))
        router.refresh()
      }
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">{err}</div>}

      <form onSubmit={add} className="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 sm:grid-cols-[100px_1fr_1fr_auto]">
        <select value={type} onChange={e => setType(e.target.value as 'photo' | 'video')} className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white">
          <option value="photo">Photo</option>
          <option value="video">Vid\u00e9o</option>
        </select>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="URL https://\u2026 (ou upload via Storage \u00e0 venir)"
          className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white placeholder-gray-600"
        />
        <input
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="L\u00e9gende (optionnel)"
          className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white placeholder-gray-600"
        />
        <button type="submit" disabled={busy} className="rounded-lg bg-[#C9A84C] px-4 py-2 text-xs font-bold text-[#07090F] disabled:opacity-50">
          + Ajouter
        </button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-xs text-gray-400">
          Aucun m\u00e9dia. Ajoutez jusqu&apos;\u00e0 {MAX_PHOTOS} photos et autant de vid\u00e9os que n\u00e9cessaire.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {items.map(item => (
            <li key={item.id} className={`rounded-xl border bg-white/5 p-2 ${item.is_cover ? 'border-[#C9A84C]/40 ring-1 ring-[#C9A84C]/20' : 'border-white/10'}`}>
              <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                {item.type === 'photo' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.caption ?? ''} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                    \u25b6 {new URL(item.url).host}
                  </div>
                )}
              </div>
              <div className="mt-2 truncate text-[11px] text-gray-400" title={item.caption ?? ''}>{item.caption ?? '\u2014'}</div>
              <div className="mt-2 flex items-center justify-between gap-2">
                {!item.is_cover ? (
                  <button onClick={() => setCover(item.id)} disabled={busy} className="text-[10px] text-[#C9A84C] hover:underline disabled:opacity-50">
                    D\u00e9finir comme cover
                  </button>
                ) : (
                  <span className="text-[10px] font-bold text-[#C9A84C]">\u2605 Cover</span>
                )}
                <button onClick={() => remove(item.id)} disabled={busy} className="text-[10px] text-red-400 hover:underline disabled:opacity-50">
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
