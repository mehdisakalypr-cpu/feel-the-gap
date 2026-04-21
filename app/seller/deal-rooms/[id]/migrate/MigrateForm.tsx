'use client'

import { useState } from 'react'

export default function MigrateForm({
  dealRoomId,
  defaultSlug,
  dealSlug,
}: {
  dealRoomId: string
  defaultSlug: string
  dealSlug: string
}) {
  const [slug, setSlug] = useState(defaultSlug)
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ public_url: string; preview_url: string; editor_url: string } | null>(null)

  function normalize(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50)
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/deal-rooms/${dealRoomId}/migrate-to-ofa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_slug: slug }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error === 'deal_room_incomplete'
          ? `Deal room incomplète : ${(data.missing as string[] | undefined)?.join(', ') ?? 'données manquantes'}`
          : data.error === 'already_migrated'
          ? 'Déjà migrée.'
          : data.error || 'Migration impossible')
      } else {
        setDone({ public_url: data.public_url, preview_url: data.preview_url, editor_url: data.editor_url })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <section className="mt-8 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-6">
        <h2 className="text-lg font-semibold text-emerald-100">Migration réussie 🎉</h2>
        <p className="mt-1 text-sm text-emerald-100/80">
          Votre site OFA est créé en draft. Vérifiez les images et le contenu, puis publiez-le depuis le back-office OFA.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <a
            href={done.preview_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-[#C9A84C] px-4 py-2 font-semibold text-[#07090F] hover:bg-[#d6b658]"
          >
            Voir en preview
          </a>
          <a
            href={done.editor_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10"
          >
            Ouvrir le back-office OFA
          </a>
          <a
            href={`/deal/${dealSlug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10"
          >
            Voir ma deal room (redirection)
          </a>
        </div>
      </section>
    )
  }

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-lg font-semibold">Configuration</h2>
      <label className="mt-4 block text-sm text-neutral-300">
        Slug du nouveau site OFA
        <div className="mt-1.5 flex items-center rounded-xl border border-white/10 bg-black/40">
          <span className="rounded-l-xl border-r border-white/10 bg-white/5 px-3 py-2 text-xs text-neutral-400">
            /site/
          </span>
          <input
            value={slug}
            onChange={e => setSlug(normalize(e.target.value))}
            className="w-full rounded-r-xl bg-transparent px-3 py-2 text-sm text-white outline-none"
            placeholder="mon-site-ofa"
            maxLength={50}
          />
        </div>
        <span className="mt-1 block text-xs text-neutral-500">
          Minuscules, chiffres, tirets uniquement. Modifiable plus tard depuis OFA si disponible.
        </span>
      </label>

      <label className="mt-6 flex items-start gap-3 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={ack}
          onChange={e => setAck(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-white/20 bg-black/30 accent-[#C9A84C]"
        />
        <span>
          Je comprends que <code className="rounded bg-white/10 px-1">/deal/{dealSlug}</code> affichera
          une bannière de redirection vers mon nouveau site OFA, et que le lead routing basculera
          automatiquement.
        </span>
      </label>

      {error && (
        <p className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          disabled={!ack || busy || slug.length < 3}
          onClick={submit}
          className="rounded-xl bg-[#C9A84C] px-5 py-2.5 text-sm font-semibold text-[#07090F] enabled:hover:bg-[#d6b658] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Migration en cours…' : 'Migrer maintenant'}
        </button>
        <a
          href={`/seller/deal-rooms/${dealRoomId}`}
          className="text-sm text-neutral-400 hover:text-white"
        >
          Annuler
        </a>
      </div>
    </section>
  )
}
