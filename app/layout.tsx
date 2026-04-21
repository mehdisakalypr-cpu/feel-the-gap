import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import { LanguageProvider } from '@/components/LanguageProvider'
import { CookieBannerProvider } from '@/components/CookieBannerProvider'
import ExitFeedback from '@/components/ExitFeedback'
import ConversionBar from '@/components/ConversionBar'
import AuthorshipMeta from '@/components/AuthorshipMeta'
import { WebVitalsReporter } from '@/components/WebVitalsReporter'
import Topbar from '@/components/Topbar'
import MaintenanceBanner from '@/components/MaintenanceBanner'
import DemoTour from '@/components/DemoTour'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://feel-the-gap.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Feel The Gap — Global Trade Intelligence',
    template: '%s — Feel The Gap',
  },
  description: 'Identify import/export gaps and unlock business opportunities worldwide. AI-powered trade intelligence for global entrepreneurs.',
  keywords: ['import export', 'trade intelligence', 'B2B marketplace', 'global trade', 'commerce international', 'opportunities', 'business plan AI'],
  authors: [{ name: 'Mehdi Sakaly' }],
  creator: 'Mehdi Sakaly',
  publisher: 'Feel The Gap',
  applicationName: 'Feel The Gap',
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: 'website',
    title: 'Feel The Gap — Global Trade Intelligence',
    description: 'AI-powered import/export opportunities for global entrepreneurs.',
    url: SITE_URL,
    siteName: 'Feel The Gap',
    locale: 'en_US',
    alternateLocale: ['fr_FR', 'es_ES'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Feel The Gap — Global Trade Intelligence',
    description: 'AI-powered import/export opportunities for global entrepreneurs.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  alternates: {
    canonical: SITE_URL,
    languages: { 'en': `${SITE_URL}/en`, 'fr': `${SITE_URL}/fr`, 'es': `${SITE_URL}/es`, 'x-default': SITE_URL },
  },
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION || undefined },
}

export const viewport = {
  themeColor: '#07090F',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} h-full`}>
      <head>
        {/* Noto Color Emoji fallback — sans cette font, Windows+Chrome et
            Linux rendent les drapeaux 🇫🇷 comme "FR" (regional indicators
            non composés). La fallback déclarée dans globals.css fait le
            pointage ; ce <link> s'assure qu'elle est disponible. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap"
        />
        <AuthorshipMeta />
      </head>
      <body className="min-h-full bg-[#07090F] text-white antialiased">
        <MaintenanceBanner />
        <WebVitalsReporter />
        <LanguageProvider>
          <CookieBannerProvider>
            <Topbar />
            {children}
            <ConversionBar />
            <ExitFeedback />
            <DemoTour />
          </CookieBannerProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
