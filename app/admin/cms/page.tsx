'use client'

import { useState, useEffect, useCallback } from 'react'
import { CMS_SITES, type SiteDef, type CollectionDef, type SlotDef } from '@/lib/cms-collections'

type CmsRow = {
  id: string
  site: string
  collection: string
  slug: string
  field_type: string
  value_en: string
  value_fr: string
  metadata: Record<string, unknown>
  order: number
  published: boolean
  updated_at: string
}

type HistoryEntry = {
  id: string
  content_id: string
  value_en: string
  value_fr: string
  changed_at: string
}

// ── Main CMS Page ───────────────────────────────────────────────────────────

export default function CmsPage() {
  const [activeSite, setActiveSite] = useState<SiteDef>(CMS_SITES[0])
  const [activeCollection, setActiveCollection] = useState<CollectionDef>(CMS_SITES[0].collections[0])
  const [rows, setRows] = useState<CmsRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, { value_en: string; value_fr: string }>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [historySlug, setHistorySlug] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [previewSlug, setPreviewSlug] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  // Fetch rows for current site+collection
  const fetchRows = useCallback(async () => {
    const res = await fetch(`/api/admin/cms?site=${activeSite.key}&collection=${activeCollection.key}`)
    const data = await res.json()
    if (Array.isArray(data)) setRows(data)
  }, [activeSite.key, activeCollection.key])

  useEffect(() => { fetchRows() }, [fetchRows])

  // Get value for a slot (draft > db > default)
  function getValue(slot: SlotDef, lang: 'en' | 'fr'): string {
    const draft = drafts[slot.slug]
    if (draft) return lang === 'en' ? draft.value_en : draft.value_fr
    const row = rows.find(r => r.slug === slot.slug)
    if (row) return lang === 'en' ? row.value_en : row.value_fr
    return lang === 'en' ? slot.default_en : slot.default_fr
  }

  // Check if slot has unsaved changes
  function isDirty(slot: SlotDef): boolean {
    return !!drafts[slot.slug]
  }

  // Update draft
  function setDraft(slug: string, lang: 'en' | 'fr', val: string) {
    setDrafts(prev => {
      const current = prev[slug] ?? {
        value_en: rows.find(r => r.slug === slug)?.value_en ?? findSlotDef(slug)?.default_en ?? '',
        value_fr: rows.find(r => r.slug === slug)?.value_fr ?? findSlotDef(slug)?.default_fr ?? '',
      }
      return { ...prev, [slug]: { ...current, [lang === 'en' ? 'value_en' : 'value_fr']: val } }
    })
  }

  function findSlotDef(slug: string): SlotDef | undefined {
    return activeCollection.slots.find(s => s.slug === slug)
  }

  // Save all dirty entries
  async function saveAll() {
    setSaving(true)
    const dirtyEntries = Object.entries(drafts)
    for (const [slug, vals] of dirtyEntries) {
      const slot = findSlotDef(slug)
      await fetch('/api/admin/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site: activeSite.key,
          collection: activeCollection.key,
          slug,
          field_type: slot?.field_type ?? 'text',
          value_en: vals.value_en,
          value_fr: vals.value_fr,
          order: activeCollection.slots.findIndex(s => s.slug === slug),
        }),
      })
    }
    setDrafts({})
    await fetchRows()
    setSaving(false)
    showToast(`${dirtyEntries.length} entrée(s) sauvegardée(s)`)
  }

  // Save single entry
  async function saveSingle(slug: string) {
    const vals = drafts[slug]
    if (!vals) return
    const slot = findSlotDef(slug)
    setSaving(true)
    await fetch('/api/admin/cms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site: activeSite.key,
        collection: activeCollection.key,
        slug,
        field_type: slot?.field_type ?? 'text',
        value_en: vals.value_en,
        value_fr: vals.value_fr,
        order: activeCollection.slots.findIndex(s => s.slug === slug),
      }),
    })
    setDrafts(prev => { const n = { ...prev }; delete n[slug]; return n })
    await fetchRows()
    setSaving(false)
    showToast(`"${slot?.label}" sauvegardé`)
  }

  // Load history for a slug
  async function loadHistory(slug: string) {
    const row = rows.find(r => r.slug === slug)
    if (!row) { setHistory([]); setHistorySlug(slug); return }
    const res = await fetch(`/api/admin/cms/history?content_id=${row.id}`)
    const data = await res.json()
    setHistory(Array.isArray(data) ? data : [])
    setHistorySlug(slug)
  }

  // Rollback to a history version
  async function rollback(historyId: string) {
    setSaving(true)
    await fetch('/api/admin/cms/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history_id: historyId }),
    })
    setHistorySlug(null)
    setHistory([])
    setDrafts(prev => { const n = { ...prev }; if (historySlug) delete n[historySlug]; return n })
    await fetchRows()
    setSaving(false)
    showToast('Version restaurée')
  }

  // Seed defaults for current collection
  async function seedDefaults() {
    setSaving(true)
    for (const slot of activeCollection.slots) {
      const existing = rows.find(r => r.slug === slot.slug)
      if (!existing) {
        await fetch('/api/admin/cms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            site: activeSite.key,
            collection: activeCollection.key,
            slug: slot.slug,
            field_type: slot.field_type,
            value_en: slot.default_en,
            value_fr: slot.default_fr,
            order: activeCollection.slots.indexOf(slot),
          }),
        })
      }
    }
    await fetchRows()
    setSaving(false)
    showToast('Valeurs par défaut initialisées')
  }

  const hasDirty = Object.keys(drafts).length > 0

  return (
    <div className="flex flex-col h-full">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-emerald-500/90 text-white text-sm rounded-lg shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* Site tabs */}
      <div className="flex items-center gap-1 border-b border-white/10 px-4 pt-3 pb-0">
        {CMS_SITES.map(site => (
          <button
            key={site.key}
            onClick={() => { setActiveSite(site); setActiveCollection(site.collections[0]); setDrafts({}); setHistorySlug(null) }}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeSite.key === site.key
                ? 'bg-[#C9A84C]/10 text-[#C9A84C] border border-b-0 border-[#C9A84C]/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {site.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left panel — collections */}
        <div className="w-48 border-r border-white/10 p-3 flex flex-col gap-1 shrink-0">
          {activeSite.collections.map(coll => (
            <button
              key={coll.key}
              onClick={() => { setActiveCollection(coll); setDrafts({}); setHistorySlug(null) }}
              className={`px-3 py-2 text-sm rounded-lg text-left transition-colors ${
                activeCollection.key === coll.key
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {coll.label}
            </button>
          ))}
          <div className="mt-auto pt-3 border-t border-white/10">
            <button onClick={seedDefaults} disabled={saving}
              className="w-full px-3 py-2 text-xs text-gray-500 hover:text-[#C9A84C] hover:bg-[#C9A84C]/5 rounded-lg transition-colors disabled:opacity-50">
              Initialiser les défauts
            </button>
          </div>
        </div>

        {/* Right panel — editor */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">{activeCollection.label}</h2>
              <p className="text-xs text-gray-500">{activeSite.label} · {activeCollection.slots.length} champs</p>
            </div>
            <div className="flex gap-2">
              {hasDirty && (
                <button onClick={saveAll} disabled={saving}
                  className="px-4 py-2 bg-[#C9A84C] text-[#07090F] font-bold text-sm rounded-lg hover:bg-[#E8C97A] transition-colors disabled:opacity-50">
                  {saving ? 'Enregistrement...' : `Publier (${Object.keys(drafts).length})`}
                </button>
              )}
            </div>
          </div>

          {/* Slots */}
          <div className="space-y-4">
            {activeCollection.slots.map(slot => {
              const isPreview = previewSlug === slot.slug
              return (
                <div key={slot.slug} className={`bg-[#0D1117] border rounded-xl p-4 transition-colors ${isDirty(slot) ? 'border-[#C9A84C]/50' : 'border-white/10'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{slot.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-white/5 text-gray-500 rounded">{slot.field_type}</span>
                      {isDirty(slot) && <span className="text-[10px] px-1.5 py-0.5 bg-[#C9A84C]/20 text-[#C9A84C] rounded">modifié</span>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setPreviewSlug(isPreview ? null : slot.slug)}
                        className="px-2 py-1 text-[10px] text-gray-500 hover:text-white bg-white/5 rounded transition-colors">
                        {isPreview ? 'Fermer' : 'Aperçu'}
                      </button>
                      <button onClick={() => loadHistory(slot.slug)}
                        className="px-2 py-1 text-[10px] text-gray-500 hover:text-white bg-white/5 rounded transition-colors">
                        Historique
                      </button>
                      {isDirty(slot) && (
                        <button onClick={() => saveSingle(slot.slug)} disabled={saving}
                          className="px-2 py-1 text-[10px] text-[#C9A84C] bg-[#C9A84C]/10 rounded hover:bg-[#C9A84C]/20 transition-colors disabled:opacity-50">
                          Publier
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Preview */}
                  {isPreview && (
                    <div className="mb-3 p-3 bg-white/5 rounded-lg border border-dashed border-white/10">
                      <div className="text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Aperçu FR</div>
                      <div className="text-sm text-white whitespace-pre-wrap">{getValue(slot, 'fr')}</div>
                      <div className="text-[10px] text-gray-500 mb-1 mt-2 uppercase tracking-wide">Aperçu EN</div>
                      <div className="text-sm text-gray-300 whitespace-pre-wrap">{getValue(slot, 'en')}</div>
                    </div>
                  )}

                  {/* Editor fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">FR</label>
                      {slot.field_type === 'richtext' || slot.field_type === 'json' ? (
                        <textarea
                          value={getValue(slot, 'fr')}
                          onChange={e => setDraft(slot.slug, 'fr', e.target.value)}
                          rows={slot.field_type === 'json' ? 4 : 3}
                          className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm resize-y focus:outline-none focus:border-[#C9A84C]/50 font-mono"
                        />
                      ) : (
                        <input
                          type={slot.field_type === 'number' ? 'number' : 'text'}
                          value={getValue(slot, 'fr')}
                          onChange={e => setDraft(slot.slug, 'fr', e.target.value)}
                          className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#C9A84C]/50"
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">EN</label>
                      {slot.field_type === 'richtext' || slot.field_type === 'json' ? (
                        <textarea
                          value={getValue(slot, 'en')}
                          onChange={e => setDraft(slot.slug, 'en', e.target.value)}
                          rows={slot.field_type === 'json' ? 4 : 3}
                          className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm resize-y focus:outline-none focus:border-[#C9A84C]/50 font-mono"
                        />
                      ) : (
                        <input
                          type={slot.field_type === 'number' ? 'number' : 'text'}
                          value={getValue(slot, 'en')}
                          onChange={e => setDraft(slot.slug, 'en', e.target.value)}
                          className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#C9A84C]/50"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* History modal */}
      {historySlug && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setHistorySlug(null)}>
          <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">Historique — {findSlotDef(historySlug)?.label}</h3>
              <button onClick={() => setHistorySlug(null)} className="text-gray-500 hover:text-white text-lg">&times;</button>
            </div>
            {history.length === 0 ? (
              <p className="text-gray-500 text-sm">Aucun historique pour ce champ.</p>
            ) : (
              <div className="space-y-3">
                {history.map(h => (
                  <div key={h.id} className="bg-white/5 rounded-lg p-3 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">
                        {new Date(h.changed_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button onClick={() => rollback(h.id)} disabled={saving}
                        className="px-3 py-1 text-xs bg-[#C9A84C]/10 text-[#C9A84C] rounded-lg hover:bg-[#C9A84C]/20 transition-colors disabled:opacity-50">
                        Restaurer
                      </button>
                    </div>
                    <div className="text-xs text-gray-400">
                      <span className="text-gray-600">FR:</span> {h.value_fr?.substring(0, 100)}{h.value_fr?.length > 100 ? '...' : ''}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      <span className="text-gray-600">EN:</span> {h.value_en?.substring(0, 100)}{h.value_en?.length > 100 ? '...' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
