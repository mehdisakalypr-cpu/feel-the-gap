'use client'

/**
 * CookieBannerProvider — wrapper client qui injecte le banner GDPR.
 *
 * Monté dans app/layout.tsx pour s'assurer qu'il s'affiche sur toutes les pages
 * publiques. N'affiche rien si le visiteur a déjà donné/refusé son consentement
 * (cf. localStorage dans <CookieBanner>).
 */

import { ReactNode } from 'react'
import CookieBanner from '@/components/CookieBanner'

export function CookieBannerProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <CookieBanner />
    </>
  )
}

export default CookieBannerProvider
