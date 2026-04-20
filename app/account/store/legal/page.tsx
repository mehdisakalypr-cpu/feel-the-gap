// © 2025-2026 Feel The Gap — legal docs management

import { redirect } from 'next/navigation'
import { requireStoreOwner } from '../_lib/store-owner'
import { createSupabaseServer } from '@/lib/supabase-server'
import { LegalDocsEditor, type LegalDocItem } from '@/components/store/LegalDocsEditor'

export const dynamic = 'force-dynamic'

const TYPES: LegalDocItem['doc_type'][] = ['cgv', 'cgu', 'mentions', 'cookies', 'dpa', 'privacy']

export default async function LegalPage() {
  const gate = await requireStoreOwner()
  if (!gate.ok) redirect(gate.redirectTo)

  const sb = await createSupabaseServer()
  const { data: docsRaw } = await sb
    .from('store_legal_docs')
    .select('id, doc_type, language, source, content_md, pdf_url, version, active, created_at')
    .eq('store_id', gate.ctx.store.id)
    .order('created_at', { ascending: false })

  const docs: LegalDocItem[] = (docsRaw ?? []).map(d => ({
    id: String(d.id),
    doc_type: String(d.doc_type) as LegalDocItem['doc_type'],
    language: String(d.language),
    source: String(d.source) as LegalDocItem['source'],
    content_md: d.content_md ? String(d.content_md) : '',
    pdf_url: d.pdf_url ? String(d.pdf_url) : null,
    version: Number(d.version),
    active: !!d.active,
    created_at: String(d.created_at),
  }))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Mentions l\u00e9gales</h1>
        <p className="mt-1 text-sm text-gray-400">
          Vos CGV, CGU, mentions l\u00e9gales et politique cookies. Versionn\u00e9es par boutique. Une version active par type/langue.
        </p>
      </header>
      <LegalDocsEditor docs={docs} types={TYPES} />
    </div>
  )
}
