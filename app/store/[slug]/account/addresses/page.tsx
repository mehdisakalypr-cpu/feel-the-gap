// © 2025-2026 Feel The Gap — buyer addresses CRUD

import { createSupabaseServer } from '@/lib/supabase-server'
import { requireBuyer } from '../_lib/store-auth'
import { AddressManager } from './form'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props { params: Promise<{ slug: string }> }

export interface AddressDTO {
  id: string
  label: string | null
  type: 'shipping' | 'billing' | 'both'
  full_name: string
  company: string | null
  line1: string
  line2: string | null
  postal_code: string
  city: string
  state: string | null
  country_iso2: string
  phone: string | null
  is_default: boolean
}

export default async function AddressesPage({ params }: Props) {
  const { slug } = await params
  const { user } = await requireBuyer(slug)
  const sb = await createSupabaseServer()

  const { data } = await sb
    .from('store_buyer_addresses')
    .select('id, label, type, full_name, company, line1, line2, postal_code, city, state, country_iso2, phone, is_default')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  const initial: AddressDTO[] = (data ?? []) as AddressDTO[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mes adresses</h1>
        <p className="mt-1 text-sm text-gray-400">
          Adresses de livraison et facturation utilisées au checkout.
        </p>
      </div>
      <AddressManager slug={slug} initial={initial} />
    </div>
  )
}
