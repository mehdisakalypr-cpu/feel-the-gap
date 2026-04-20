// © 2025-2026 Feel The Gap — store settings

import { redirect } from 'next/navigation'
import { requireStoreOwner } from '../_lib/store-owner'
import { SettingsForm } from '@/components/store/SettingsForm'

export const dynamic = 'force-dynamic'

export default async function StoreSettingsPage() {
  const gate = await requireStoreOwner()
  if (!gate.ok) redirect(gate.redirectTo)
  const { store } = gate.ctx

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Param\u00e8tres</h1>
        <p className="mt-1 text-sm text-gray-400">Modes, entit\u00e9 de facturation, domaine personnalis\u00e9, branding et 2FA.</p>
      </header>

      <SettingsForm
        initial={{
          name: store.name,
          mode_b2b: store.mode_b2b,
          mode_b2c: store.mode_b2c,
          primary_color: store.primary_color ?? '#C9A84C',
          custom_domain: store.custom_domain ?? '',
          twofa_enabled: store.twofa_enabled,
          billing_entity: store.billing_entity ?? {},
        }}
      />
    </div>
  )
}
