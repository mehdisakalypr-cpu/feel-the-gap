import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { LanguageProvider } from '@/components/LanguageProvider'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })

export const metadata: Metadata = {
  title: 'Feel The Gap — Global Trade Intelligence',
  description: 'Identify import/export gaps and unlock business opportunities worldwide.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} h-full`}>
      <head>
        <Script
          defer
          src="https://analytics01.duckdns.org/script.js"
          data-website-id="aa89f216-b8da-4d17-93cb-610d0998389b"
          strategy="afterInteractive"
        />
      </head>
      <body className="min-h-full bg-[#07090F] text-white antialiased">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  )
}
