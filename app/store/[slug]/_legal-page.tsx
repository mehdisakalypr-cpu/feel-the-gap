// © 2025-2026 Feel The Gap — generic legal-doc renderer (server-only helper)

import { createSupabaseServer } from '@/lib/supabase-server'
import { StoreChrome } from '@/components/store-public/StoreChrome'
import { loadChrome } from './_chrome'

interface Props {
  slug: string
  docType: 'cgv' | 'cgu' | 'mentions' | 'cookies'
  defaultTitle: string
  fallbackBody: string
}

interface DocRow {
  content_md: string
  language: string
  source: string
  version: number
}

const ACCEPT_LANGUAGE_FALLBACK = ['fr', 'en', 'es']

export async function renderLegalDoc(props: Props) {
  const { store, user, cartCount } = await loadChrome(props.slug)
  const accent = store.primary_color || '#C9A84C'
  const sb = await createSupabaseServer()

  const { data } = await sb
    .from('store_legal_docs')
    .select('content_md, language, source, version')
    .eq('store_id', store.id)
    .eq('doc_type', props.docType)
    .eq('active', true)
    .order('version', { ascending: false })
    .limit(20)

  const rows = (data ?? []) as DocRow[]
  let pick: DocRow | null = null
  for (const lang of ACCEPT_LANGUAGE_FALLBACK) {
    pick = rows.find(r => r.language === lang) ?? null
    if (pick) break
  }
  if (!pick && rows.length > 0) pick = rows[0]

  const body = pick?.content_md ?? props.fallbackBody

  return (
    <StoreChrome
      slug={store.slug}
      name={store.name}
      logoUrl={store.logo_url}
      accent={accent}
      cartCount={cartCount}
      userEmail={user?.email ?? null}
    >
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold text-white">{props.defaultTitle}</h1>
        {pick && (
          <p className="mt-1 text-[10px] text-gray-500">
            Version {pick.version} — {pick.language.toUpperCase()} — source : {pick.source === 'template' ? 'modèle FTG' : 'document client'}
          </p>
        )}
        <div className="prose prose-invert mt-6 max-w-none whitespace-pre-line rounded-2xl border border-white/5 bg-[#0D1117] p-6 text-sm leading-relaxed text-gray-200">
          {body}
        </div>
      </article>
    </StoreChrome>
  )
}
