import type { MetadataRoute } from 'next'

const SITE = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://www.gapup.io'
const LOCALES = ['en', 'fr', 'es'] as const
const NOW = new Date()

const STATIC_PATHS: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
  { path: '/',             changeFrequency: 'weekly',  priority: 1.0 },
  { path: '/pricing',      changeFrequency: 'weekly',  priority: 0.9 },
  { path: '/marketplace',  changeFrequency: 'daily',   priority: 0.9 },
  { path: '/demo',         changeFrequency: 'monthly', priority: 0.8 },
  { path: '/methods',      changeFrequency: 'monthly', priority: 0.7 },
  { path: '/auth/login',   changeFrequency: 'yearly',  priority: 0.5 },
  { path: '/auth/register',changeFrequency: 'yearly',  priority: 0.6 },
  { path: '/legal',        changeFrequency: 'yearly',  priority: 0.3 },
  { path: '/legal/mentions',     changeFrequency: 'yearly', priority: 0.3 },
  { path: '/legal/authorship',   changeFrequency: 'yearly', priority: 0.4 },
  { path: '/data',         changeFrequency: 'daily',   priority: 0.7 },
  { path: '/finance',      changeFrequency: 'monthly', priority: 0.6 },
  { path: '/onboarding',   changeFrequency: 'monthly', priority: 0.6 },
  { path: '/training',     changeFrequency: 'weekly',  priority: 0.5 },
  { path: '/formation',    changeFrequency: 'weekly',  priority: 0.5 },
  { path: '/tools',        changeFrequency: 'monthly', priority: 0.7 },
  { path: '/tools/eori',   changeFrequency: 'monthly', priority: 0.8 },
]

const COUNTRIES_ISO3 = [
  'FRA','USA','CHN','DEU','GBR','JPN','IND','ITA','ESP','BRA','CAN','AUS','MEX','RUS','KOR','NLD','TUR','SAU','CHE','ARE',
  'POL','SWE','BEL','THA','ARG','EGY','PAK','MYS','PHL','VNM','IDN','ZAF','NGA','KEN','MAR','DZA','GHA','CIV','SEN','TUN',
  'PRT','GRC','IRL','AUT','DNK','NOR','FIN','SGP','HKG','TWN','NZL','ISR','CZE','HUN','ROU','UKR','CHL','COL','PER','VEN',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = []

  for (const { path, changeFrequency, priority } of STATIC_PATHS) {
    entries.push({
      url: `${SITE}${path}`,
      lastModified: NOW,
      changeFrequency,
      priority,
      alternates: {
        languages: Object.fromEntries(LOCALES.map(l => [l, `${SITE}/${l}${path}`])),
      },
    })
  }

  for (const iso of COUNTRIES_ISO3) {
    entries.push({
      url: `${SITE}/country/${iso.toLowerCase()}`,
      lastModified: NOW,
      changeFrequency: 'weekly',
      priority: 0.7,
      alternates: {
        languages: Object.fromEntries(LOCALES.map(l => [l, `${SITE}/${l}/country/${iso.toLowerCase()}`])),
      },
    })
  }

  return entries
}
