// © 2025-2026 Feel The Gap — buyer single address PATCH/DELETE
import { NextRequest, NextResponse } from 'next/server'
import { authBuyerForStore } from '../../_lib/store-api'

export const runtime = 'nodejs'

interface Params { params: Promise<{ slug: string; id: string }> }

interface AddressInput {
  label?: string | null
  type?: 'shipping' | 'billing' | 'both'
  full_name?: string
  company?: string | null
  line1?: string
  line2?: string | null
  postal_code?: string
  city?: string
  state?: string | null
  country_iso2?: string
  phone?: string | null
  is_default?: boolean
}

function sanitize(input: AddressInput): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (input.label !== undefined) out.label = input.label?.trim() || null
  if (input.type && ['shipping', 'billing', 'both'].includes(input.type)) out.type = input.type
  if (typeof input.full_name === 'string') out.full_name = input.full_name.trim()
  if (input.company !== undefined) out.company = input.company?.trim() || null
  if (typeof input.line1 === 'string') out.line1 = input.line1.trim()
  if (input.line2 !== undefined) out.line2 = input.line2?.trim() || null
  if (typeof input.postal_code === 'string') out.postal_code = input.postal_code.trim()
  if (typeof input.city === 'string') out.city = input.city.trim()
  if (input.state !== undefined) out.state = input.state?.trim() || null
  if (typeof input.country_iso2 === 'string') out.country_iso2 = input.country_iso2.trim().toUpperCase().slice(0, 2)
  if (input.phone !== undefined) out.phone = input.phone?.trim() || null
  if (typeof input.is_default === 'boolean') out.is_default = input.is_default
  return out
}

export async function PATCH(req: NextRequest, ctx: Params) {
  const { slug, id } = await ctx.params
  const auth = await authBuyerForStore(slug)
  if (!auth.ok) return auth.response
  const { sb, user } = auth
  let body: AddressInput
  try { body = (await req.json()) as AddressInput } catch { return NextResponse.json({ error: 'invalid_body' }, { status: 400 }) }
  const clean = sanitize(body)

  if (clean.is_default === true) {
    await sb.from('store_buyer_addresses')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .eq('is_default', true)
      .neq('id', id)
  }

  const { error } = await sb.from('store_buyer_addresses')
    .update(clean)
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  const { slug, id } = await ctx.params
  const auth = await authBuyerForStore(slug)
  if (!auth.ok) return auth.response
  const { sb, user } = auth
  const { error } = await sb.from('store_buyer_addresses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
