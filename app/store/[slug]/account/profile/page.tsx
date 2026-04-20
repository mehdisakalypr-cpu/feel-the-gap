// © 2025-2026 Feel The Gap — buyer profile (name + email + password change)

import { requireBuyer } from '../_lib/store-auth'
import { ProfileForm } from './form'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props { params: Promise<{ slug: string }> }

export default async function ProfilePage({ params }: Props) {
  const { slug } = await params
  const { user, store } = await requireBuyer(slug)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Profil</h1>
        <p className="mt-1 text-sm text-gray-400">
          Vos informations personnelles utilisées sur {store.name}.
        </p>
      </div>
      <ProfileForm slug={slug} email={user.email ?? ''} />
    </div>
  )
}
