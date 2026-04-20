'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmtDate } from './_utils'

export interface LegalDocItem {
  id: string
  doc_type: 'cgv' | 'cgu' | 'mentions' | 'cookies' | 'dpa' | 'privacy' | 'custom'
  language: string
  source: 'template' | 'custom'
  content_md: string
  pdf_url: string | null
  version: number
  active: boolean
  created_at: string
}

interface Props {
  docs: LegalDocItem[]
  types: LegalDocItem['doc_type'][]
}

const LABEL: Record<LegalDocItem['doc_type'], string> = {
  cgv: 'CGV',
  cgu: 'CGU',
  mentions: 'Mentions l\u00e9gales',
  cookies: 'Politique cookies',
  dpa: 'DPA',
  privacy: 'Politique de confidentialit\u00e9',
  custom: 'Document personnalis\u00e9',
}

export function LegalDocsEditor({ docs, types }: Props) {
  const router = useRouter()
  const [type, setType] = useState<LegalDocItem['doc_type']>('cgv')
  const [language, setLanguage] = useState('fr')
  const [source, setSource] = useState<'template' | 'custom'>('template')
  const [content, setContent] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (source === 'custom' && !content.trim() && !pdfUrl.trim()) {
      setErr('Contenu Markdown ou URL PDF requis pour un document personnalis\u00e9.'); return
    }
    setBusy(true)
    try {
      const r = await fetch('/api/store/legal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: type,
          language,
          source,
          content_md: content,
          pdf_url: pdfUrl.trim() || null,
        }),
      })
      const j = await r.json()
      if (!r.ok || j.error) {
        setErr(j.message ?? j.error ?? 'Erreur.')
      } else {
        setContent(''); setPdfUrl('')
        router.refresh()
      }
    } finally { setBusy(false) }
  }

  async function setActive(id: string) {
    setBusy(true)
    try {
      const r = await fetch('/api/store/legal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: true }),
      })
      if (r.ok) router.refresh()
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</div>}
        <div className="grid gap-2 sm:grid-cols-3">
          <select value={type} onChange={e => setType(e.target.value as LegalDocItem['doc_type'])} className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white">
            {types.map(t => <option key={t} value={t}>{LABEL[t]}</option>)}
          </select>
          <select value={language} onChange={e => setLanguage(e.target.value)} className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white">
            <option value="fr">Fran\u00e7ais</option>
            <option value="en">English</option>
            <option value="es">Espa\u00f1ol</option>
          </select>
          <select value={source} onChange={e => setSource(e.target.value as 'template' | 'custom')} className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white">
            <option value="template">Mod\u00e8le FTG</option>
            <option value="custom">Personnalis\u00e9</option>
          </select>
        </div>
        {source === 'custom' && (
          <>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Contenu Markdown du document\u2026"
              rows={10}
              className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 font-mono text-xs text-white"
            />
            <input
              value={pdfUrl}
              onChange={e => setPdfUrl(e.target.value)}
              placeholder="ou URL PDF (optionnel)"
              className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
            />
          </>
        )}
        <div className="flex justify-end">
          <button type="submit" disabled={busy} className="rounded-lg bg-[#C9A84C] px-5 py-2 text-xs font-bold text-[#07090F] hover:bg-[#E8C97A] disabled:opacity-50">
            {busy ? 'Cr\u00e9ation\u2026' : 'Cr\u00e9er nouvelle version'}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]">
        <div className="grid grid-cols-12 border-b border-white/5 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          <div className="col-span-3">Document</div>
          <div className="col-span-1">Lang</div>
          <div className="col-span-2">Source</div>
          <div className="col-span-1">v</div>
          <div className="col-span-3">Cr\u00e9\u00e9</div>
          <div className="col-span-2 text-right">Actif</div>
        </div>
        {docs.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Aucun document. Cr\u00e9ez votre premi\u00e8re version ci-dessus.</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {docs.map(d => (
              <li key={d.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                <div className="col-span-3 text-white">{LABEL[d.doc_type]}</div>
                <div className="col-span-1 text-gray-300">{d.language}</div>
                <div className="col-span-2 text-gray-400">{d.source}</div>
                <div className="col-span-1 text-gray-300">{d.version}</div>
                <div className="col-span-3 text-xs text-gray-400">{fmtDate(d.created_at)}</div>
                <div className="col-span-2 text-right">
                  {d.active ? (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                      actif
                    </span>
                  ) : (
                    <button onClick={() => setActive(d.id)} disabled={busy} className="text-[10px] text-[#C9A84C] hover:underline disabled:opacity-50">
                      Activer
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
