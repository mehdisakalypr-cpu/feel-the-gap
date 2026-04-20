// © 2025-2026 Feel The Gap — buyer login (per-store)

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getStoreBySlug } from '../_lib/store-auth'
import { LoginForm } from './form'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ redirect?: string }>
}

export default async function StoreLoginPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = (await searchParams) ?? {}
  const store = await getStoreBySlug(slug)
  if (!store) redirect('/')

  // If already authenticated, jump straight to the dashboard.
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (user) {
    const next = (sp.redirect && sp.redirect.startsWith('/') && !sp.redirect.startsWith('//'))
      ? sp.redirect
      : `/store/${store.slug}/account`
    redirect(next)
  }

  const fallbackRedirect = `/store/${store.slug}/account`
  const safeRedirect = (sp.redirect && sp.redirect.startsWith('/') && !sp.redirect.startsWith('//'))
    ? sp.redirect
    : fallbackRedirect

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-white">Connexion</h1>
        <p className="mt-1 text-sm text-gray-400">
          Accédez à vos commandes sur <span className="text-[#C9A84C]">{store.name}</span>.
        </p>
      </div>
      <LoginForm slug={store.slug} postLoginPath={safeRedirect} />
      <p className="mt-6 text-center text-sm text-gray-400">
        Pas encore de compte ?{' '}
        <Link
          href={`/store/${store.slug}/account/register?redirect=${encodeURIComponent(safeRedirect)}`}
          className="text-[#C9A84C] hover:underline"
        >
          Créer un compte
        </Link>
      </p>
    </div>
  )
}
