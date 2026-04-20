// © 2025-2026 Feel The Gap — buyer register (per-store)

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getStoreBySlug } from '../_lib/store-auth'
import { RegisterForm } from './form'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ redirect?: string }>
}

export default async function StoreRegisterPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = (await searchParams) ?? {}
  const store = await getStoreBySlug(slug)
  if (!store) redirect('/')

  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (user) redirect(`/store/${store.slug}/account`)

  const fallbackRedirect = `/store/${store.slug}/account`
  const safeRedirect = (sp.redirect && sp.redirect.startsWith('/') && !sp.redirect.startsWith('//'))
    ? sp.redirect
    : fallbackRedirect

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-white">Créer un compte</h1>
        <p className="mt-1 text-sm text-gray-400">
          Pour suivre vos commandes sur <span className="text-[#C9A84C]">{store.name}</span>.
        </p>
      </div>
      <RegisterForm slug={store.slug} storeName={store.name} postLoginPath={safeRedirect} />
      <p className="mt-6 text-center text-sm text-gray-400">
        Déjà inscrit ?{' '}
        <Link
          href={`/store/${store.slug}/account/login?redirect=${encodeURIComponent(safeRedirect)}`}
          className="text-[#C9A84C] hover:underline"
        >
          Se connecter
        </Link>
      </p>
    </div>
  )
}
