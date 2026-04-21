'use client'
import SectionSynthesizing from '@/components/SectionSynthesizing'

export default function OppPageClient({
  oppId, country, section, label, icon,
}: {
  oppId: string
  country: string
  section: string
  label: string
  icon?: string
}) {
  return (
    <SectionSynthesizing
      oppId={oppId}
      country={country}
      section={section}
      label={label}
      icon={icon}
      onReady={() => window.location.reload()}
    />
  )
}
