import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { CountrySidebar } from '@/components/CountrySidebar'
import type { PlanTier } from '@/lib/credits/costs'

async function getUserContext(iso: string): Promise<{
  tier: PlanTier
  credits: { subscription: number; topup: number; total: number }
}> {
  const defaultCtx = {
    tier: 'free' as PlanTier,
    credits: { subscription: 0, topup: 0, total: 0 },
  }
  try {
    const jar = await cookies()
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => jar.getAll().map(({ name, value }) => ({ name, value })),
          setAll: () => {},
        },
      },
    )
    const { data } = await sb.auth.getUser()
    if (!data?.user) return defaultCtx

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )
    const { data: balance } = await admin.rpc('credits_balance', { p_user_id: data.user.id })
    const b = balance?.[0]
    return {
      tier: (b?.plan ?? 'free') as PlanTier,
      credits: {
        subscription: b?.subscription ?? 0,
        topup: b?.topup ?? 0,
        total: b?.total ?? 0,
      },
    }
  } catch {
    return defaultCtx
  }
}

export default async function CountryLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ iso: string }>
}) {
  const { iso } = await params
  const ctx = await getUserContext(iso)
  return (
    <div className="min-h-screen flex bg-[#07090F]">
      <CountrySidebar iso={iso.toUpperCase()} userTier={ctx.tier} userCredits={ctx.credits} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
