'use client'

/**
 * Country layout — mount JourneySidebar persistent across /country/[iso]/*
 * navigations. Clicking a section in the sidebar swaps `{children}` without
 * re-mounting the sidebar → tab-like UX (no flash, sidebar stays fixed).
 *
 * currentStep detected from pathname. userTier fetched once client-side then
 * passed as prop to JourneySidebar.
 */

import { useEffect, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import JourneyContextProvider from '@/components/JourneyContextProvider'
import JourneySidebar, { type JourneyStep } from '@/components/JourneySidebar'
import JourneyStickyDock from '@/components/JourneyStickyDock'
import { createSupabaseBrowser } from '@/lib/supabase'

function stepFromPathname(pathname: string): JourneyStep {
  // /country/[iso] → country | /country/[iso]/methods → methods | etc.
  const parts = pathname.split('/').filter(Boolean)
  // parts = ['country', '<iso>', maybe <section>]
  const section = parts[2]
  switch (section) {
    case 'methods':        return 'methods'
    case 'enriched-plan':
    case 'plan':           return 'business_plan'
    case 'videos':         return 'videos'
    case 'clients':        return 'clients'
    case 'recap':          return 'recap'
    case 'store':          return 'store'
    case 'success':        return 'success'
    default:               return 'country'
  }
}

export default function CountryLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const iso = (params?.iso as string ?? '').toUpperCase()
  const currentStep = stepFromPathname(pathname ?? '')
  const [userTier, setUserTier] = useState<string>('free')

  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await sb.from('profiles').select('tier').eq('id', data.user.id).maybeSingle()
      if (profile?.tier) setUserTier(profile.tier)
    })
  }, [])

  return (
    <JourneyContextProvider>
      <JourneySidebar iso={iso} currentStep={currentStep} userTier={userTier} />
      {/* lg:pl-80 pour éviter le recouvrement avec le sidebar fixed w-80
          pb-24 pour éviter que le contenu soit masqué derrière le JourneyStickyDock fixed */}
      <div className="lg:pl-80 pb-24">{children}</div>
      <JourneyStickyDock />
    </JourneyContextProvider>
  )
}
