// © 2025-2026 Feel The Gap — legal docs CRUD (versionned)

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { requireOwnerApi } from '@/app/account/store/_lib/store-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type DocType = 'cgv' | 'cgu' | 'mentions' | 'cookies' | 'dpa' | 'privacy' | 'custom'
const DOC_TYPES: DocType[] = ['cgv', 'cgu', 'mentions', 'cookies', 'dpa', 'privacy', 'custom']

const TEMPLATES: Partial<Record<DocType, string>> = {
  cgv: `# Conditions G\u00e9n\u00e9rales de Vente\n\n_Mod\u00e8le FTG \u2014 \u00e0 personnaliser._\n\n## 1. Vendeur\n[\u00c0 compl\u00e9ter dans les param\u00e8tres de la boutique]\n\n## 2. Produits\n[Description des produits]\n\n## 3. Prix et paiement\n[Modalit\u00e9s]\n`,
  cgu: `# Conditions G\u00e9n\u00e9rales d'Utilisation\n\n_Mod\u00e8le FTG._\n`,
  mentions: `# Mentions L\u00e9gales\n\n[\u00c0 compl\u00e9ter avec votre raison sociale, SIRET, h\u00e9bergeur, contact.]\n`,
  cookies: `# Politique cookies\n\n_Mod\u00e8le FTG._\n`,
  dpa: `# Data Processing Agreement (DPA)\n\n_Mod\u00e8le FTG._\n`,
  privacy: `# Politique de confidentialit\u00e9\n\n_Mod\u00e8le FTG._\n`,
}

export async function GET() {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const sb = await createSupabaseServer()
  const { data, error } = await sb
    .from('store_legal_docs')
    .select('*')
    .eq('store_id', auth.storeId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ docs: data })
}

interface PostBody {
  doc_type: DocType
  language: string
  source: 'template' | 'custom'
  content_md?: string
  pdf_url?: string | null
}

export async function POST(req: NextRequest) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const sb = await createSupabaseServer()
  let body: PostBody
  try { body = (await req.json()) as PostBody } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!DOC_TYPES.includes(body.doc_type)) return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
  const language = (body.language || 'fr').slice(0, 5)
  const source = body.source === 'custom' ? 'custom' : 'template'

  let content = body.content_md ?? ''
  if (source === 'template') {
    content = TEMPLATES[body.doc_type] ?? `# ${body.doc_type}\n\n_Mod\u00e8le FTG_`
  }
  if (source === 'custom' && !content.trim() && !body.pdf_url) {
    return NextResponse.json({ error: 'content_required' }, { status: 400 })
  }

  // Determine next version
  const { data: latest } = await sb
    .from('store_legal_docs')
    .select('version')
    .eq('store_id', auth.storeId)
    .eq('doc_type', body.doc_type)
    .eq('language', language)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextVersion = (latest?.version ?? 0) + 1

  // Deactivate previous versions
  await sb
    .from('store_legal_docs')
    .update({ active: false })
    .eq('store_id', auth.storeId)
    .eq('doc_type', body.doc_type)
    .eq('language', language)

  const { data, error } = await sb
    .from('store_legal_docs')
    .insert({
      store_id: auth.storeId,
      doc_type: body.doc_type,
      language,
      source,
      content_md: content,
      pdf_url: body.pdf_url ?? null,
      version: nextVersion,
      active: true,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'insert_failed', message: error.message }, { status: 400 })

  // Mark legal_docs_complete if cgv & mentions both active
  const { data: actives } = await sb
    .from('store_legal_docs')
    .select('doc_type')
    .eq('store_id', auth.storeId)
    .eq('active', true)
  const types = new Set((actives ?? []).map(a => a.doc_type as string))
  if (types.has('cgv') && types.has('mentions')) {
    await sb.from('stores').update({ legal_docs_complete: true, updated_at: new Date().toISOString() }).eq('id', auth.storeId)
  }

  return NextResponse.json({ doc: data }, { status: 201 })
}

interface PatchBody {
  id: string
  active?: boolean
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const sb = await createSupabaseServer()
  let body: PatchBody
  try { body = (await req.json()) as PatchBody } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!body.id) return NextResponse.json({ error: 'id_required' }, { status: 400 })

  // If activating: deactivate other versions of same doc_type+language
  if (body.active === true) {
    const { data: target } = await sb
      .from('store_legal_docs')
      .select('doc_type, language')
      .eq('id', body.id)
      .eq('store_id', auth.storeId)
      .maybeSingle()
    if (target) {
      await sb
        .from('store_legal_docs')
        .update({ active: false })
        .eq('store_id', auth.storeId)
        .eq('doc_type', target.doc_type)
        .eq('language', target.language)
    }
  }

  const { data, error } = await sb
    .from('store_legal_docs')
    .update({ active: body.active ?? true })
    .eq('id', body.id)
    .eq('store_id', auth.storeId)
    .select()
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 400 })

  return NextResponse.json({ doc: data })
}
